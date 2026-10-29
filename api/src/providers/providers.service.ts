import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { AppDb } from '../prisma/app-db.service';
import { RcloneService } from '../rclone/rclone.service';
import { num } from '../common/bigint';
import { PROVIDER_LABELS } from '../common/providers';
import { SpaceSnapshot } from '../generated/app/client';
import { ProviderDto, SpaceDto } from './dto/provider.dto';

type RemoteProvider = ProviderDto['id'];

const toSpace = (s: SpaceSnapshot): SpaceDto => ({
  takenAt: s.takenAt.toISOString(),
  totalBytes: num(s.totalBytes),
  usedBytes: num(s.usedBytes),
  freeBytes: num(s.freeBytes),
  trashedBytes: num(s.trashedBytes),
});

@Injectable()
export class ProvidersService {
  constructor(
    private readonly config: AppConfig,
    private readonly db: AppDb,
    private readonly rclone: RcloneService,
  ) {}

  remoteFor(id: string): string {
    const remotes: Record<RemoteProvider, string> = {
      gdrive: this.config.get('GDRIVE_REMOTE'),
      onedrive: this.config.get('ONEDRIVE_REMOTE'),
    };
    const remote = remotes[id as RemoteProvider];
    if (!remote)
      throw new NotFoundException(`No rclone remote set up for ${id}`);
    return remote;
  }

  async list(): Promise<ProviderDto[]> {
    const ids: RemoteProvider[] = ['gdrive', 'onedrive'];
    return Promise.all(
      ids.map(async (id) => {
        const latest = await this.db.spaceSnapshot.findFirst({
          where: { provider: id },
          orderBy: { takenAt: 'desc' },
        });
        return {
          id,
          label: PROVIDER_LABELS[id],
          remote:
            id === 'gdrive'
              ? this.config.get('GDRIVE_REMOTE')
              : this.config.get('ONEDRIVE_REMOTE'),
          space: latest ? toSpace(latest) : null,
        };
      }),
    );
  }

  /** Ask the provider how much space is used and free, and keep the answer. */
  async checkSpace(id: RemoteProvider): Promise<SpaceDto> {
    const about = await this.rclone.about(this.remoteFor(id));
    const snap = await this.db.spaceSnapshot.create({
      data: {
        provider: id,
        totalBytes: about.total ?? null,
        usedBytes: about.used ?? null,
        freeBytes: about.free ?? null,
        trashedBytes: about.trashed ?? null,
      },
    });
    return toSpace(snap);
  }

  async spaceHistory(id: RemoteProvider, days: number): Promise<SpaceDto[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.db.spaceSnapshot.findMany({
      where: { provider: id, takenAt: { gte: since } },
      orderBy: { takenAt: 'asc' },
    });
    return rows.map(toSpace);
  }
}
