import { Injectable } from '@angular/core';
import type {
  Copy,
  CopyPage,
  CopyQuery,
  DailyTotals,
  JobRun,
  Provider,
  ProviderId,
  ProviderTotals,
  RemoteProviderId,
  Restore,
  Space,
  UiConfig,
} from '../models';
import { OffsiteData } from './offsite-data';

// Generic, made-up data for the GitHub Pages demo. Nothing here comes from a real library.

const DAY = 86_400_000;
const GiB = 1024 ** 3;
const TiB = 1024 ** 4;
const STORE_KEY = 'offsite-demo-restores';

function rng(seed: number): () => number {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
}

const FOLDERS = ['Documents', 'Photos', 'Scans', 'Notes', 'Projects', 'Spreadsheets'];
const EXT: Record<string, string[]> = {
  Documents: ['pdf', 'docx', 'txt'],
  Photos: ['jpg', 'heic', 'png'],
  Scans: ['pdf', 'tif'],
  Notes: ['md', 'txt'],
  Projects: ['zip', 'psd', 'svg'],
  Spreadsheets: ['xlsx', 'csv'],
};

function buildCopies(): Copy[] {
  const r = rng(42);
  const hex = () => Array.from({ length: 64 }, () => Math.floor(r() * 16).toString(16)).join('');
  const now = Date.now();
  const out: Copy[] = [];
  for (let i = 1; i <= 640; i++) {
    const folder = FOLDERS[Math.floor(r() * FOLDERS.length)];
    const exts = EXT[folder];
    const ext = exts[Math.floor(r() * exts.length)];
    const provider: ProviderId = r() < 0.62 ? 'gdrive' : r() < 0.8 ? 'gphotos' : 'onedrive';
    const year = 2012 + Math.floor(r() * 14);
    const size = Math.round((folder === 'Photos' ? 2 + r() * 8 : 0.05 + r() * 4) * 1024 ** 2);
    out.push({
      id: i,
      hash: hex(),
      provider,
      remotePath: `offsite-demo/${folder}/${year}/${folder.toLowerCase()}-${String(i).padStart(4, '0')}.${ext}`,
      size,
      placedBy: provider === 'gphotos' ? 'gphotos_upload' : 'rclone_push',
      verifiedBy: provider === 'onedrive' ? 'rclone_check' : 'drivefs_md5',
      verifiedAt: new Date(now - Math.floor(r() * 88) * DAY - Math.floor(r() * DAY)).toISOString(),
    });
  }
  return out.sort((a, b) => b.id - a.id);
}

@Injectable()
export class DemoData extends OffsiteData {
  private readonly all = buildCopies();
  private readonly space: Record<RemoteProviderId, Space> = {
    gdrive: this.snap(5 * TiB, 3.08 * TiB),
    onedrive: this.snap(1.1e12, 0.41e12),
  };

  private snap(total: number, used: number): Space {
    return {
      takenAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      totalBytes: Math.round(total),
      usedBytes: Math.round(used),
      freeBytes: Math.round(total - used),
      trashedBytes: Math.round(2.4 * GiB),
    };
  }

  private savedRestores(): Restore[] {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Restore[];
    } catch {
      return [];
    }
  }

  private saveRestores(list: Restore[]) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
      // storage blocked: the demo still works, it just forgets
    }
  }

  async config(): Promise<UiConfig> {
    return {
      apiBase: 'api',
      basePath: '/',
      publicUrl: '',
      frameParents: [],
      login: { enabled: false, issuer: '', clientId: '' },
    };
  }

  async providers(): Promise<Provider[]> {
    return [
      { id: 'gdrive', label: 'Google Drive', remote: 'gdrive-demo', space: this.space.gdrive, lastError: null },
      { id: 'onedrive', label: 'OneDrive', remote: 'onedrive-demo', space: this.space.onedrive, lastError: null },
    ];
  }

  async checkSpace(id: RemoteProviderId): Promise<Space> {
    const s = { ...this.space[id], takenAt: new Date().toISOString() };
    this.space[id] = s;
    return s;
  }

  async totals(): Promise<ProviderTotals[]> {
    const by = new Map<ProviderId, ProviderTotals>();
    for (const c of this.all) {
      const t = by.get(c.provider) ?? { provider: c.provider, files: 0, bytes: 0, lastVerifiedAt: null };
      t.files++;
      t.bytes += c.size ?? 0;
      if (!t.lastVerifiedAt || (c.verifiedAt ?? '') > t.lastVerifiedAt) t.lastVerifiedAt = c.verifiedAt;
      by.set(c.provider, t);
    }
    return [...by.values()];
  }

  async daily(days: number): Promise<DailyTotals[]> {
    const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
    const by = new Map<string, DailyTotals>();
    for (const c of this.all) {
      const day = (c.verifiedAt ?? '').slice(0, 10);
      if (!day || day < since) continue;
      const key = `${day}|${c.provider}`;
      const t = by.get(key) ?? { day, provider: c.provider, files: 0, bytes: 0 };
      t.files++;
      t.bytes += c.size ?? 0;
      by.set(key, t);
    }
    return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
  }

  async copies(q: CopyQuery): Promise<CopyPage> {
    const text = q.q?.trim().toLowerCase();
    const rows = this.all.filter(
      (c) =>
        (!q.provider || c.provider === q.provider) &&
        (!text || c.hash.startsWith(text) || c.remotePath.toLowerCase().includes(text)),
    );
    return { items: rows.slice(q.skip, q.skip + q.take), total: rows.length };
  }

  async restores(): Promise<Restore[]> {
    return this.savedRestores();
  }

  async restore(copyId: number): Promise<Restore> {
    const copy = this.all.find((c) => c.id === copyId);
    if (!copy) throw new Error(`No offsite copy ${copyId}`);
    const list = this.savedRestores();
    const id = (list[0]?.id ?? 0) + 1;
    const name = copy.remotePath.split('/').pop() ?? 'file';
    const now = new Date().toISOString();
    const restore: Restore = {
      id,
      provider: copy.provider,
      hash: copy.hash,
      remotePath: copy.remotePath,
      destination: `restores/${id}/${name}`,
      status: 'succeeded',
      requestedAt: now,
      finishedAt: now,
      bytes: copy.size,
      error: null,
    };
    this.saveRestores([restore, ...list]);
    return restore;
  }

  async jobs(): Promise<JobRun[]> {
    const r = rng(7);
    const now = Date.now();
    const pushes: JobRun[] = Array.from({ length: 14 }, (_, i) => {
      const started = now - (i * 2 + 1) * DAY;
      const files = 200 + Math.floor(r() * 1800);
      const provider = i % 3 === 0 ? 'onedrive' : 'gdrive';
      return {
        id: 100 - i,
        provider,
        kind: 'push',
        status: i === 4 ? 'failed' : 'succeeded',
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date(started + (1 + r() * 5) * 3600_000).toISOString(),
        filesTotal: files,
        filesDone: i === 4 ? Math.floor(files / 3) : files,
        bytesTotal: Math.round(files * 3.2 * 1024 ** 2),
        bytesDone: Math.round((i === 4 ? files / 3 : files) * 3.2 * 1024 ** 2),
        message: i === 4 ? 'Daily upload limit reached; resumes tomorrow' : null,
      };
    });
    const restores: JobRun[] = this.savedRestores().map((x) => ({
      id: 1000 + x.id,
      provider: x.provider,
      kind: 'restore',
      status: 'succeeded',
      startedAt: x.requestedAt,
      finishedAt: x.finishedAt,
      filesTotal: 1,
      filesDone: 1,
      bytesTotal: x.bytes,
      bytesDone: x.bytes ?? 0,
      message: null,
    }));
    return [...restores, ...pushes];
  }
}
