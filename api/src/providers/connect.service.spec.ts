import { EventEmitter } from 'node:events';
import { ConnectService } from './connect.service';

/** A stand-in for a running `rclone authorize`: prints the helper address, then the token once "answered". */
function fakeAuthorize() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    exitCode: null as number | null,
    kill: jest.fn(),
  });
  setTimeout(() => child.stderr.emit('data', Buffer.from('NOTICE: Please go to the following link: http://127.0.0.1:53682/auth?state=abc\n')), 10);
  const answer = () => {
    child.stdout.emit('data', Buffer.from('Paste the following into your remote machine --->\n{"access_token":"at","refresh_token":"rt"}\n<---End paste\n'));
    child.exitCode = 0;
    child.emit('close', 0);
  };
  return { child, answer };
}

function setup(opts: { account?: string; signedInAs?: string } = {}) {
  const auth = fakeAuthorize();
  const rclone = {
    configDump: jest.fn().mockResolvedValue({ 'gd-remote': { type: 'drive', client_id: 'cid', client_secret: 'cs', scope: 'drive.file' } }),
    configFile: jest.fn().mockResolvedValue('/nonexistent/rclone.conf'),
    configUpdate: jest.fn().mockResolvedValue(''),
    configCreate: jest.fn().mockResolvedValue(''),
    start: jest.fn().mockReturnValue(auth.child),
  };
  const providers = {
    remoteFor: (id: string) => (id === 'gdrive' ? 'gd-remote:' : 'od-remote:'),
    checkSpace: jest.fn().mockResolvedValue({}),
    list: jest.fn().mockResolvedValue([{ id: 'gdrive' }, { id: 'onedrive' }]),
  };
  const config = { get: (k: string) => (k === 'GDRIVE_ACCOUNT' ? (opts.account ?? '') : '') };
  global.fetch = jest.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.startsWith('http://127.0.0.1:53682/auth')) {
      return new Response(null, { status: 302, headers: { location: 'https://accounts.example/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F&state=abc' } });
    }
    if (u.startsWith('http://127.0.0.1:53682/?')) {
      if (!u.includes('state=abc')) return new Response('bad state', { status: 400 });
      auth.answer();
      return new Response('ok');
    }
    if (u.includes('googleapis.com/drive/v3/about')) return Response.json({ user: { emailAddress: opts.signedInAs ?? 'owner@example.com' } });
    if (u.includes('graph.microsoft.com')) return Response.json({ id: 'drv', driveType: 'personal', owner: { user: { displayName: 'Owner' } } });
    throw new Error(`unexpected fetch ${u}`);
  }) as typeof fetch;
  const svc = new ConnectService(config as never, rclone as never, providers as never);
  return { svc, rclone, providers };
}

const back = 'http://127.0.0.1:53682/?state=abc&code=xyz';

describe('ConnectService', () => {
  it("starts rclone with the remote's own OAuth app and returns the provider's sign-in page", async () => {
    const { svc, rclone } = setup();
    const start = await svc.start('gdrive');
    expect(start.authUrl).toContain('accounts.example');
    expect(start.redirectUri).toBe('http://127.0.0.1:53682/');
    const args = rclone.start.mock.calls[0][0] as string[];
    expect(args.slice(0, 2)).toEqual(['authorize', 'drive']);
    expect(JSON.parse(Buffer.from(args[2], 'base64').toString())).toEqual({ client_id: 'cid', client_secret: 'cs', scope: 'drive.file' });
  });

  it('saves the token to the configured remote only, after checking the account', async () => {
    const { svc, rclone, providers } = setup({ account: 'Owner@example.com' });
    await svc.start('gdrive');
    const r = await svc.finish('gdrive', back);
    expect(r.account).toBe('owner@example.com');
    expect(rclone.configUpdate).toHaveBeenCalledWith('gd-remote:', { token: '{"access_token":"at","refresh_token":"rt"}' });
    expect(providers.checkSpace).toHaveBeenCalledWith('gdrive');
  });

  it('refuses a sign-in to a different account and saves nothing', async () => {
    const { svc, rclone } = setup({ account: 'owner@example.com', signedInAs: 'someone@else.com' });
    await svc.start('gdrive');
    await expect(svc.finish('gdrive', back)).rejects.toThrow(/someone@else.com.*Nothing was saved/);
    expect(rclone.configUpdate).not.toHaveBeenCalled();
  });

  it('creates the OneDrive remote with its drive when it does not exist yet', async () => {
    const { svc, rclone } = setup();
    await svc.start('onedrive');
    await svc.finish('onedrive', back);
    expect(rclone.configCreate).toHaveBeenCalledWith('od-remote:', 'onedrive', expect.objectContaining({ drive_id: 'drv', drive_type: 'personal' }));
  });

  it('rejects addresses that are not the sign-in answer, and a denied consent', async () => {
    const { svc, rclone } = setup();
    await expect(svc.finish('gdrive', back)).rejects.toThrow(/No sign-in is waiting/);
    await svc.start('gdrive');
    await expect(svc.finish('gdrive', 'https://evil.example/?code=1')).rejects.toThrow(/did not load/);
    await expect(svc.finish('gdrive', 'not a url')).rejects.toThrow(/not a web address/);
    await expect(svc.finish('gdrive', 'http://127.0.0.1:53682/?state=other&code=x')).rejects.toThrow(/different or older sign-in/);
    await expect(svc.finish('gdrive', 'http://127.0.0.1:53682/?error=access_denied')).rejects.toThrow(/access_denied.*Nothing was saved/);
    expect(rclone.configUpdate).not.toHaveBeenCalled();
  });
});
