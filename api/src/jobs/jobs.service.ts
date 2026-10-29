import { Injectable } from '@nestjs/common';
import { AppDb } from '../prisma/app-db.service';
import { num } from '../common/bigint';
import { JobRun } from '../generated/app/client';
import { JobRunDto } from './dto/job.dto';

export const toJobRun = (j: JobRun): JobRunDto => ({
  id: j.id,
  provider: j.provider,
  kind: j.kind,
  status: j.status,
  startedAt: j.startedAt.toISOString(),
  finishedAt: j.finishedAt?.toISOString() ?? null,
  filesTotal: j.filesTotal,
  filesDone: j.filesDone,
  bytesTotal: num(j.bytesTotal),
  bytesDone: num(j.bytesDone) ?? 0,
  message: j.message,
});

@Injectable()
export class JobsService {
  constructor(private readonly db: AppDb) {}

  async recent(take: number): Promise<JobRunDto[]> {
    const rows = await this.db.jobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take,
    });
    return rows.map(toJobRun);
  }
}
