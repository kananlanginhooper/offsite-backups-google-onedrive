import { EventEmitter } from 'node:events';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectService, pastedToken } from './connect.service';

/** A stand-in for a running `rclone authorize`: prints the helper address, then the token once "answered". */
function fakeAuthorize() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    exitCode: null as number | null,
    kill: jest.fn(),
  });
  setTimeout(
    () =>
      child.stderr.emit(
        'data',
        Buffer.from(
          'NOTICE: Please go to the following link: http://127.0.0.1:53682/auth?state=abc\n',
        ),
      ),
    10,
  );
  const answer = () => {
    child.stdout.emit(
      'data',
      Buffer.from(
        'Paste the following into your remote machine --->\n{"access_token":"at","refresh_token":"rt"}\n<---End paste\n',
      ),
    );
    child.exitCode = 0;
    child.emit('close', 0);
  };
  return { child, answer };
}

function setup(
  opts: { account?: string; signedInAs?: string; confFile?: string } = {},
) {
  const auth = fakeAuthorize();
  const rclone = {
    configDump: jest.fn().mockResolvedValue({
      'gd-remote': {
        type: 'drive',
        client_id: 'cid',
        client_secret: 'cs',
        scope: 'drive.file',
      },
    }),
    configFile: jest
      .fn()
      .mockResolvedValue(opts.confFile ?? '/nonexistent/rclone.conf'),
    configUpdate: jest.fn().mockResolvedValue(''),
    configCreate: jest.fn().mockResolvedValue(''),
    start: jest.fn().mockReturnValue(auth.child),
  };
  const providers = {
    remoteFor: (id: string) => (id === 'gdrive' ? 'gd-remote:' : 'od-remote:'),
    checkSpace: jest.fn().mockResolvedValue({}),
    list: jest.fn().mockResolvedValue([{ id: 'gdrive' }, { id: 'onedrive' }]),
  };
  const config = {
    get: (k: string) => (k === 'GDRIVE_ACCOUNT' ? (opts.account ?? '') : ''),
  };
  const reply = (u: string): Response => {
    if (u.startsWith('http://127.0.0.1:53682/auth')) {
      return new Response(null, {
        status: 302,
        headers: {
          location:
            'https://accounts.example/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F&state=abc',
        },
      });
    }
    if (u.startsWith('http://127.0.0.1:53682/?')) {
      if (!u.includes('state=abc'))
        return new Response('bad state', { status: 400 });
      auth.answer();
      return new Response('ok');
    }
    if (u.includes('googleapis.com/drive/v3/about'))
      return Response.json({
        user: { emailAddress: opts.signedInAs ?? 'owner@example.com' },
      });
    if (u.includes('graph.microsoft.com'))
      return Response.json({
        id: 'drv',
        driveType: 'personal',
        owner: { user: { displayName: 'Owner' } },
      });
    throw new Error(`unexpected fetch ${u}`);
  };
  global.fetch = jest.fn((url: string | URL) =>
    Promise.resolve(reply(String(url))),
  ) as typeof fetch;
  const svc = new ConnectService(
    config as never,
    rclone as never,
    providers as never,
  );
  return { svc, rclone, providers };
}

const back = 'http://127.0.0.1:53682/?state=abc&code=xyz';

describe('ConnectService', () => {
  it("starts rclone with the remote's own OAuth app and returns the provider's sign-in page", async () => {
    const { svc, rclone } = setup();
    const start = await svc.start('gdrive');
    expect(start.authUrl).toContain('accounts.example');
    expect(start.redirectUri).toBe('http://127.0.0.1:53682/');
    const args = (rclone.start.mock.calls[0] as string[][])[0];
    expect(args.slice(0, 2)).toEqual(['authorize', 'drive']);
    expect(args[2]).not.toMatch(/=/); // rclone refuses padded base64
    expect(JSON.parse(Buffer.from(args[2], 'base64').toString())).toEqual({
      client_id: 'cid',
      client_secret: 'cs',
      scope: 'drive.file',
    });
  });

  it('saves the token to the configured remote only, after checking the account', async () => {
    const { svc, rclone, providers } = setup({ account: 'Owner@example.com' });
    await svc.start('gdrive');
    const r = await svc.finish('gdrive', back);
    expect(r.account).toBe('owner@example.com');
    expect(rclone.configUpdate).toHaveBeenCalledWith('gd-remote:', {
      token: '{"access_token":"at","refresh_token":"rt"}',
    });
    expect(providers.checkSpace).toHaveBeenCalledWith('gdrive');
  });

  it('keeps a dated copy of rclone.conf before saving', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'connect-'));
    const conf = join(dir, 'rclone.conf');
    writeFileSync(conf, ['[gd-remote]', 'token = old', ''].join('\n'));
    const { svc } = setup({ confFile: conf });
    await svc.start('gdrive');
    await svc.finish('gdrive', back);
    const copies = readdirSync(dir).filter((f) =>
      f.startsWith('rclone.conf.bak-'),
    );
    expect(copies).toHaveLength(1);
    expect(readFileSync(join(dir, copies[0]), 'utf8')).toContain('token = old');
  });

  it('refuses a sign-in to a different account and saves nothing', async () => {
    const { svc, rclone } = setup({
      account: 'owner@example.com',
      signedInAs: 'someone@else.com',
    });
    await svc.start('gdrive');
    await expect(svc.finish('gdrive', back)).rejects.toThrow(
      /someone@else.com.*Nothing was saved/,
    );
    expect(rclone.configUpdate).not.toHaveBeenCalled();
  });

  it('creates the OneDrive remote with its drive when it does not exist yet', async () => {
    const { svc, rclone } = setup();
    await svc.start('onedrive');
    await svc.finish('onedrive', back);
    expect(rclone.configCreate).toHaveBeenCalledWith(
      'od-remote:',
      'onedrive',
      expect.objectContaining({ drive_id: 'drv', drive_type: 'personal' }),
    );
  });

  it('rejects addresses that are not the sign-in answer, and a denied consent', async () => {
    const { svc, rclone } = setup();
    await expect(svc.finish('gdrive', back)).rejects.toThrow(
      /No sign-in is waiting/,
    );
    await svc.start('gdrive');
    await expect(
      svc.finish('gdrive', 'https://evil.example/?code=1'),
    ).rejects.toThrow(/did not load/);
    await expect(svc.finish('gdrive', 'not a url')).rejects.toThrow(
      /not a web address/,
    );
    await expect(
      svc.finish('gdrive', 'http://127.0.0.1:53682/?state=other&code=x'),
    ).rejects.toThrow(/different or older sign-in/);
    await expect(
      svc.finish('gdrive', 'http://127.0.0.1:53682/?error=access_denied'),
    ).rejects.toThrow(/access_denied.*Nothing was saved/);
    expect(rclone.configUpdate).not.toHaveBeenCalled();
  });

  it('reads the token whether rclone prints it as JSON or as a base64 config blob', () => {
    const token = '{"access_token":"at","refresh_token":"rt"}';
    const wrap = (body: string) =>
      `NOTICE: Got code
Paste the following into your remote machine --->
${body}
<---End paste
`;
    expect(pastedToken(wrap(token))).toBe(token);
    const blob = Buffer.from(JSON.stringify({ token })).toString('base64');
    expect(pastedToken(wrap(blob.replace(/=+$/, '')))).toBe(token);
    expect(pastedToken(wrap('not a token'))).toBeUndefined();
    expect(pastedToken('NOTICE: Got code')).toBeUndefined();
  });
});
