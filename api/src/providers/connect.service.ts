import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  chmodSync,
  chownSync,
  copyFileSync,
  existsSync,
  statSync,
} from 'node:fs';
import { AppConfig } from '../config/app-config.service';
import { name, RcloneService } from '../rclone/rclone.service';
import { ConnectResultDto, ConnectStartDto } from './dto/connect.dto';
import { ProvidersService } from './providers.service';

type RemoteProvider = 'gdrive' | 'onedrive';

/** rclone's local sign-in helper listens here, inside this app's own host or container. */
const HELPER = 'http://127.0.0.1:53682';
const BACKEND: Record<RemoteProvider, string> = {
  gdrive: 'drive',
  onedrive: 'onedrive',
};
const WAIT_MS = 15_000;
/** How long rclone may take to swap the code for a token after the helper got it. */
const EXCHANGE_MS = 120_000;
const SESSION_MS = 10 * 60_000;

interface Token {
  access_token: string;
}

interface Session {
  id: RemoteProvider;
  child: ChildProcessWithoutNullStreams;
  out: string;
  err: string;
  exited: Promise<number | null>;
  timer: NodeJS.Timeout;
}

/**
 * Signs a remote in (or back in) from the dashboard, without a terminal.
 *
 * `rclone authorize` does the provider part: it knows each provider's sign-in page, scopes and
 * token exchange, and listens on 127.0.0.1:53682 for the provider's answer. That address is the
 * one the OAuth apps allow, but it is this app's own loopback, not the viewer's, so the browser's
 * final page doesn't load there. The viewer pastes that page's address back, and this service
 * hands it to rclone's helper. rclone prints the token, which is checked against the remote's
 * account and saved into rclone.conf for the configured remote only (the push jobs share it).
 */
@Injectable()
export class ConnectService {
  private readonly log = new Logger(ConnectService.name);
  private session?: Session;

  constructor(
    private readonly config: AppConfig,
    private readonly rclone: RcloneService,
    private readonly providers: ProvidersService,
  ) {}

  async start(id: RemoteProvider): Promise<ConnectStartDto> {
    this.stop();
    const remote = this.providers.remoteFor(id);
    const settings = (await this.rclone.configDump())[name(remote)] ?? {};
    // The remote's own OAuth app and scope (Google: its own client, drive.file only).
    const app: Record<string, string> = {};
    for (const key of ['client_id', 'client_secret', 'scope'])
      if (settings[key]) app[key] = settings[key];
    const args = ['authorize', BACKEND[id]];
    // rclone reads this blob as standard base64 without '=' padding (padding fails to decode)
    if (Object.keys(app).length)
      args.push(
        Buffer.from(JSON.stringify(app)).toString('base64').replace(/=+$/, ''),
      );
    args.push('--auth-no-open-browser');

    const child = this.rclone.start(args);
    const s: Session = {
      id,
      child,
      out: '',
      err: '',
      exited: new Promise((resolve) => child.on('close', resolve)),
      timer: setTimeout(() => this.stop(), SESSION_MS).unref(),
    };
    child.stdout.on('data', (d: Buffer) => (s.out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (s.err += d.toString()));
    child.on('error', (e) => (s.err += e.message));
    this.session = s;

    const helper = await this.waitFor(
      s,
      () => /http:\/\/127\.0\.0\.1:53682\/auth\?state=[\w-]+/.exec(s.err)?.[0],
    );
    if (!helper) {
      this.stop();
      throw new ServiceUnavailableException(
        `rclone authorize did not start: ${s.err.trim().slice(-300)}`,
      );
    }
    const res = await fetch(helper, { redirect: 'manual' });
    const authUrl = res.headers.get('location');
    if (!authUrl) {
      this.stop();
      throw new ServiceUnavailableException(
        'rclone did not give a sign-in page.',
      );
    }
    const redirectUri =
      new URL(authUrl).searchParams.get('redirect_uri') ?? `${HELPER}/`;
    this.log.log(`${id}: sign-in started for ${name(remote)}`);
    return { authUrl, redirectUri };
  }

  async finish(id: RemoteProvider, pasted: string): Promise<ConnectResultDto> {
    const s = this.session;
    if (!s || s.id !== id)
      throw new BadRequestException('No sign-in is waiting. Start again.');
    let url: URL;
    try {
      url = new URL(pasted.trim());
    } catch {
      throw new BadRequestException(
        'That is not a web address. Paste the whole address from the address bar.',
      );
    }
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '53682'
    )
      throw new BadRequestException(
        'Paste the address of the page that did not load (it starts with http://127.0.0.1:53682 or http://localhost:53682).',
      );
    const denied = url.searchParams.get('error');
    if (denied) {
      this.stop();
      throw new BadRequestException(
        `The provider said: ${url.searchParams.get('error_description') ?? denied}. Nothing was saved.`,
      );
    }
    if (!url.searchParams.get('code'))
      throw new BadRequestException('That address has no sign-in code in it.');

    const res = await fetch(`${HELPER}/?${url.searchParams.toString()}`);
    if (!res.ok)
      throw new BadRequestException(
        'That address is from a different or older sign-in. Start again.',
      );
    await Promise.race([
      s.exited,
      new Promise((r) => setTimeout(r, EXCHANGE_MS).unref()),
    ]);
    const json = pastedToken(s.out + s.err);
    const running = s.child.exitCode === null;
    this.stop();
    if (!json) {
      // stderr holds rclone's notices and errors, never the token (that goes to stdout)
      this.log.warn(
        `${id}: no token (${running ? `rclone still running after ${EXCHANGE_MS / 1000}s` : `rclone exit ${s.child.exitCode}`}): ${s.err.trim().slice(-2000)}`,
      );
      const why = s.err
        .split('\n')
        .filter((l) => /error|fail|invalid/i.test(l))
        .slice(-3)
        .join(' ')
        .trim();
      throw new ServiceUnavailableException(
        running
          ? `rclone got the code but did not return a token within ${EXCHANGE_MS / 1000} seconds. Nothing was saved. Start again.`
          : `rclone could not swap the code for a token: ${why || s.err.trim().slice(-300)} Nothing was saved. Start again.`,
      );
    }
    const token = JSON.parse(json) as Token;

    const remote = this.providers.remoteFor(id);
    const account =
      id === 'gdrive'
        ? await this.saveGoogle(remote, json, token)
        : await this.saveOneDrive(remote, json, token);
    this.log.log(
      `${id}: signed in${account ? ` as ${account}` : ''}; saved to ${name(remote)}`,
    );
    try {
      await this.providers.checkSpace(id);
    } catch {
      // the card shows the reason
    }
    const provider = (await this.providers.list()).find((p) => p.id === id)!;
    return { account, provider };
  }

  private async saveGoogle(
    remote: string,
    json: string,
    token: Token,
  ): Promise<string | null> {
    const about = await bearer<{ user?: { emailAddress?: string } }>(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      token,
    );
    const account = about.user?.emailAddress ?? null;
    this.checkAccount('GDRIVE_ACCOUNT', account);
    await this.write(() => this.rclone.configUpdate(remote, { token: json }));
    return account;
  }

  private async saveOneDrive(
    remote: string,
    json: string,
    token: Token,
  ): Promise<string | null> {
    const drive = await bearer<{
      id: string;
      driveType: string;
      owner?: { user?: { email?: string; displayName?: string } };
    }>('https://graph.microsoft.com/v1.0/me/drive', token);
    const account =
      drive.owner?.user?.email ?? drive.owner?.user?.displayName ?? null;
    if (drive.owner?.user?.email)
      this.checkAccount('ONEDRIVE_ACCOUNT', drive.owner.user.email);
    const values = {
      token: json,
      drive_id: drive.id,
      drive_type: drive.driveType,
    };
    const exists = name(remote) in (await this.rclone.configDump());
    await this.write(() =>
      exists
        ? this.rclone.configUpdate(remote, values)
        : this.rclone.configCreate(remote, 'onedrive', values),
    );
    return account;
  }

  /** A remote belongs to one account: a sign-in to any other account is refused before anything is saved. */
  private checkAccount(
    key: 'GDRIVE_ACCOUNT' | 'ONEDRIVE_ACCOUNT',
    account: string | null,
  ): void {
    const expected = this.config.get(key).trim().toLowerCase();
    if (expected && account && account.toLowerCase() !== expected)
      throw new ConflictException(
        `Signed in as ${account}, but this remote belongs to ${this.config.get(key)}. Nothing was saved.`,
      );
  }

  /**
   * The change is made by rclone itself, which re-reads rclone.conf, changes only that remote and
   * replaces the file (temp file, then rename). First a dated copy is kept next to it. rclone's
   * new file belongs to whoever ran it, so the original owner and mode are put back, both on the
   * file and on the copy, so the push jobs that share it can still read it.
   */
  private async write(change: () => Promise<string>): Promise<void> {
    const file = await this.rclone.configFile();
    const before = existsSync(file) ? statSync(file) : null;
    const keep = (path: string) => {
      if (before && process.getuid?.() === 0) {
        chownSync(path, before.uid, before.gid);
        chmodSync(path, before.mode & 0o777);
      }
    };
    if (before) {
      const copy = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      copyFileSync(file, copy);
      keep(copy);
      this.log.log(`kept a copy of rclone.conf before saving: ${copy}`);
    }
    await change();
    keep(file);
  }

  private async waitFor<T>(
    s: Session,
    found: () => T | undefined,
  ): Promise<T | undefined> {
    const until = Date.now() + WAIT_MS;
    while (Date.now() < until && s.child.exitCode === null) {
      const v = found();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 100));
    }
    return found();
  }

  private stop(): void {
    const s = this.session;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.child.exitCode === null) s.child.kill();
    this.session = undefined;
  }
}

/**
 * The token between rclone's "--->" and "<---End paste" markers. Without a config blob rclone
 * prints the token JSON itself; given one (a remote with its own OAuth app), it prints base64 of
 * a JSON config whose "token" value is the token JSON. Returns the token JSON, or undefined.
 */
export function pastedToken(output: string): string | undefined {
  const pasted = /--->\s*([\s\S]*?)\s*<---End paste/.exec(output)?.[1].trim();
  if (!pasted) return undefined;
  const parse = (text: string): Record<string, unknown> | undefined => {
    try {
      const v: unknown = JSON.parse(text);
      return v && typeof v === 'object'
        ? (v as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  };
  const obj =
    parse(pasted) ?? parse(Buffer.from(pasted, 'base64').toString('utf8'));
  if (!obj) return undefined;
  if (typeof obj.access_token === 'string') return JSON.stringify(obj);
  if (typeof obj.token === 'string' && parse(obj.token)?.access_token)
    return obj.token;
  return undefined;
}

async function bearer<T>(url: string, token: Token): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok)
    throw new ServiceUnavailableException(
      `Signed in, but the account check failed (${res.status}). Nothing was saved.`,
    );
  return (await res.json()) as T;
}
