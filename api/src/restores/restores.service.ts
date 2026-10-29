import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { AppConfig } from '../config/app-config.service';
import { AppDb } from '../prisma/app-db.service';
import { RcloneService } from '../rclone/rclone.service';
import { CopiesService } from '../copies/copies.service';
import { ProvidersService } from '../providers/providers.service';
import { num } from '../common/bigint';
import { RestoreRequest } from '../generated/app/client';
import { RestoreDto } from './dto/restore.dto';

const toRestore = (r: RestoreRequest): RestoreDto => ({
  id: r.id,
  provider: r.provider,
  hash: r.hash,
  remotePath: r.remotePath,
  destination: r.destination,
  status: r.status,
  requestedAt: r.requestedAt.toISOString(),
  finishedAt: r.finishedAt?.toISOString() ?? null,
  bytes: num(r.bytes),
  error: r.error,
});

/**
 * Copies offsite files back down. Each restore lands in its own new folder under RESTORE_ROOT,
 * so it never overwrites anything, and it only reads from the provider.
 */
@Injectable()
export class RestoresService {
  private readonly log = new Logger(RestoresService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly db: AppDb,
    private readonly rclone: RcloneService,
    private readonly copies: CopiesService,
    private readonly providers: ProvidersService,
  ) {}

  async recent(take: number): Promise<RestoreDto[]> {
    const rows = await this.db.restoreRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      take,
    });
    return rows.map(toRestore);
  }

  async create(copyId: number): Promise<RestoreDto> {
    const copy = await this.copies.get(copyId);
    if (copy.provider === 'gphotos') {
      throw new BadRequestException(
        'Google Photos copies are not restored through rclone here',
      );
    }
    const remote = this.providers.remoteFor(copy.provider);
    const job = await this.db.jobRun.create({
      data: {
        provider: copy.provider,
        kind: 'restore',
        status: 'running',
        filesTotal: 1,
      },
    });
    const req = await this.db.restoreRequest.create({
      data: {
        provider: copy.provider,
        hash: copy.hash,
        remotePath: copy.remotePath,
        destination: '',
        status: 'running',
        jobRunId: job.id,
      },
    });
    const root = resolve(this.config.get('RESTORE_ROOT'));
    const destination = join(root, String(req.id), basename(copy.remotePath));
    const saved = await this.db.restoreRequest.update({
      where: { id: req.id },
      data: { destination },
    });
    void this.run(saved.id, job.id, remote, copy.remotePath, destination);
    return toRestore(saved);
  }

  private async run(
    id: number,
    jobId: number,
    remote: string,
    remotePath: string,
    destination: string,
  ) {
    const finished = () => new Date();
    try {
      await this.rclone.copyDown(remote, remotePath, destination);
      const { size } = await stat(destination);
      await this.db.restoreRequest.update({
        where: { id },
        data: { status: 'succeeded', bytes: size, finishedAt: finished() },
      });
      await this.db.jobRun.update({
        where: { id: jobId },
        data: {
          status: 'succeeded',
          filesDone: 1,
          bytesDone: size,
          bytesTotal: size,
          finishedAt: finished(),
        },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.log.error(`restore ${id} failed: ${error}`);
      await this.db.restoreRequest.update({
        where: { id },
        data: { status: 'failed', error, finishedAt: finished() },
      });
      await this.db.jobRun.update({
        where: { id: jobId },
        data: { status: 'failed', message: error, finishedAt: finished() },
      });
    }
  }
}
