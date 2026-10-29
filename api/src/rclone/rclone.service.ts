import { Injectable } from '@nestjs/common';
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
    return this.run(['about', `${remote}:`, '--json']).then(
      (out) => JSON.parse(out) as RcloneAbout,
    );
  }

  /** Copy one remote file down to a local path. Never touches the remote. */
  copyDown(
    remote: string,
    remotePath: string,
    localPath: string,
  ): Promise<string> {
    return this.run(['copyto', `${remote}:${remotePath}`, localPath]);
  }

  private run(args: string[]): Promise<string> {
    const env = { ...process.env };
    const conf = this.config.get('RCLONE_CONFIG');
    if (conf) env.RCLONE_CONFIG = conf;
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.get('RCLONE_BIN'), args, { env });
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (err += d.toString()));
      child.on('error', reject);
      child.on('close', (code) =>
        code === 0
          ? resolve(out)
          : reject(new Error(`rclone ${args[0]} exit ${code}: ${err.trim()}`)),
      );
    });
  }
}
