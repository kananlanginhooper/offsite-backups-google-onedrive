import { Injectable, NotFoundException } from '@nestjs/common';
import { RecoveryDb } from '../prisma/recovery-db.service';
import { num } from '../common/bigint';
import type { ProviderId } from '../common/providers';
import { Prisma, offsite_copy } from '../generated/recovery/client';
import {
  CopyDto,
  CopyPageDto,
  CopyQueryDto,
  DailyTotalsDto,
  ProviderTotalsDto,
} from './dto/copy.dto';

const VERIFIED: Prisma.offsite_copyWhereInput = {
  verified_by: { not: 'none' },
};

const toCopy = (c: offsite_copy): CopyDto => ({
  id: Number(c.id),
  hash: c.hash,
  provider: c.provider,
  remotePath: c.remote_path,
  size: num(c.size),
  placedBy: c.placed_by,
  verifiedBy: c.verified_by,
  verifiedAt: c.verified_at?.toISOString() ?? null,
});

/** Reads recovery.offsite_copy, which the push jobs write: what is offsite, and where. */
@Injectable()
export class CopiesService {
  constructor(private readonly db: RecoveryDb) {}

  async totals(): Promise<ProviderTotalsDto[]> {
    const rows = await this.db.offsite_copy.groupBy({
      by: ['provider'],
      where: VERIFIED,
      _count: { _all: true },
      _sum: { size: true },
      _max: { verified_at: true },
    });
    return rows.map((r) => ({
      provider: r.provider,
      files: r._count._all,
      bytes: num(r._sum.size) ?? 0,
      lastVerifiedAt: r._max.verified_at?.toISOString() ?? null,
    }));
  }

  async daily(days: number): Promise<DailyTotalsDto[]> {
    const rows = await this.db.$queryRaw<
      { day: Date; provider: ProviderId; files: bigint; bytes: bigint | null }[]
    >`SELECT DATE(verified_at) AS day, provider, COUNT(*) AS files, SUM(size) AS bytes
        FROM offsite_copy
       WHERE verified_by <> 'none' AND verified_at >= CURDATE() - INTERVAL ${days} DAY
       GROUP BY day, provider ORDER BY day`;
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      provider: r.provider,
      files: Number(r.files),
      bytes: num(r.bytes) ?? 0,
    }));
  }

  async page(query: CopyQueryDto): Promise<CopyPageDto> {
    const q = query.q?.trim();
    const where: Prisma.offsite_copyWhereInput = {
      ...(query.provider && { provider: query.provider }),
      ...(q &&
        (/^[0-9a-f]{6,64}$/i.test(q)
          ? { hash: { startsWith: q.toLowerCase() } }
          : { remote_path: { contains: q } })),
    };
    const [rows, total] = await Promise.all([
      this.db.offsite_copy.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.db.offsite_copy.count({ where }),
    ]);
    return { items: rows.map(toCopy), total };
  }

  async get(id: number): Promise<CopyDto> {
    const row = await this.db.offsite_copy.findUnique({
      where: { id: BigInt(id) },
    });
    if (!row) throw new NotFoundException(`No offsite copy ${id}`);
    return toCopy(row);
  }
}
