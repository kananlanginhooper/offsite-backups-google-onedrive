import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { chmodSync, chownSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppConfig } from '../config/app-config.service';

export interface RcloneAbout {
  total?: number;
  used?: number;
  free?: number;
  trashed?: number;
}

/** Runs the rclone CLI. Remote names and sign-ins live in rclone.conf (RCLONE_CONFIG). */
@Injectable()
export class RcloneService {
  constructor(private readonly config: AppConfig) {}

  about(remote: string): Promise<RcloneAbout> {
    return this.run(['about', root(remote), '--json']).then(
      (out) => JSON.parse(out) as RcloneAbout,
    );
  }

  /** Copy one remote file down to a local path. Never touches the remote. */
  copyDown(
    remote: string,
    remotePath: string,
    localPath: string,
  ): Promise<string> {
    return this.run(['copyto', root(remote) + remotePath, localPath]);
  }

  /** Every remote's settings, sign-in tokens included. Read on the server only; never sent out. */
  async configDump(): Promise<Record<string, Record<string, string>>> {
    return JSON.parse(await this.run(['config', 'dump'])) as Record<
      string,
      Record<string, string>
    >;
  }

  /** Where rclone.conf is (the last line of `rclone config file`). */
  async configFile(): Promise<string> {
    return (await this.run(['config', 'file'])).trim().split('\n').pop() ?? '';
  }

  /** Set some of a remote's settings, without starting rclone's own sign-in. */
  configUpdate(
    remote: string,
    values: Record<string, string>,
  ): Promise<string> {
    return this.run([
      'config',
      'update',
      name(remote),
      ...pairs(values),
      '--non-interactive',
    ]);
  }

  /** Add a remote, without starting rclone's own sign-in. */
  configCreate(
    remote: string,
    type: string,
    values: Record<string, string>,
  ): Promise<string> {
    return this.run([
      'config',
      'create',
      name(remote),
      type,
      ...pairs(values),
      '--non-interactive',
    ]);
  }

  /** Start a long-running rclone (e.g. `authorize`) and hand back the process. */
  start(args: string[]): ChildProcessWithoutNullStreams {
    const child = spawn(this.config.get('RCLONE_BIN'), args, {
      env: this.env(),
    });
    child.on('close', () => this.keepOwner());
    return child;
  }

  /**
   * rclone rewrites rclone.conf whenever it refreshes a token, on any command, and the new file
   * belongs to whoever ran it (root in the container). The push jobs run as the folder's owner and
   * must still read it, so after every run the file goes back to that owner, mode 600.
   */
  private keepOwner(): void {
    const conf = this.config.get('RCLONE_CONFIG');
    if (!conf || process.getuid?.() !== 0) return;
    try {
      const dir = statSync(dirname(conf));
      const file = statSync(conf);
      if (file.uid !== dir.uid || file.gid !== dir.gid)
        chownSync(conf, dir.uid, dir.gid);
      if ((file.mode & 0o777) !== 0o600) chmodSync(conf, 0o600);
    } catch {
      // no rclone.conf yet
    }
  }

  private env(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    const conf = this.config.get('RCLONE_CONFIG');
    if (conf) env.RCLONE_CONFIG = conf;
    return env;
  }

  /** Failures (rclone missing, signed out, provider error) surface as 503 with rclone's own message. */
  private run(args: string[]): Promise<string> {
    const env = this.env();
    const fail = (why: string) =>
      new ServiceUnavailableException(`rclone ${args[0]}: ${why}`);
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.get('RCLONE_BIN'), args, { env });
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', (e) => reject(fail(e.message)));
      child.on('close', (code) => {
        this.keepOwner();
        if (code === 0) resolve(out);
        else reject(fail(`exit ${code}: ${oneLine(err)}`));
      });
    });
  }
}

/** "name" and "name:" both mean the remote's root (the pushers' settings keep the colon). */
function root(remote: string): string {
  return remote.endsWith(':') ? remote : `${remote}:`;
}

/** The remote's name as rclone.conf spells its section: no colon. */
export function name(remote: string): string {
  return remote.replace(/:$/, '');
}

function pairs(values: Record<string, string>): string[] {
  return Object.entries(values).flat();
}

/** rclone's error as one line. Its log line is often followed by a multi-line JSON reply
 *  (e.g. an OAuth "invalid_grant"), so the whole output is kept, minus the timestamps. */
function oneLine(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d /, '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 600);
}
