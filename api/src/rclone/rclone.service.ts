import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
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

  /** Failures (rclone missing, signed out, provider error) surface as 503 with rclone's own message. */
  private run(args: string[]): Promise<string> {
    const env = { ...process.env };
    const conf = this.config.get('RCLONE_CONFIG');
    if (conf) env.RCLONE_CONFIG = conf;
    const fail = (why: string) =>
      new ServiceUnavailableException(`rclone ${args[0]}: ${why}`);
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.get('RCLONE_BIN'), args, { env });
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', (e) => reject(fail(e.message)));
      child.on('close', (code) =>
        code === 0
          ? resolve(out)
          : reject(fail(`exit ${code}: ${oneLine(err)}`)),
      );
    });
  }
}

/** "name" and "name:" both mean the remote's root (the pushers' settings keep the colon). */
function root(remote: string): string {
  return remote.endsWith(':') ? remote : `${remote}:`;
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
