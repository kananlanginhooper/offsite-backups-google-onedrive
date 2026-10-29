import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { OffsiteData } from '../../core/data/offsite-data';
import type { DailyTotals, Provider, ProviderTotals, RemoteProviderId } from '../../core/models';
import { ProviderChip } from '../../shared/provider-chip';
import { StatTile } from '../../shared/stat-tile';
import { ago, bytes, count } from '../../shared/format';
import { ConnectDialog } from './connect-dialog';
import { DailyChart } from './daily-chart';
import { ProviderCard } from './provider-card';

/** A space answer older than this is refreshed when the page opens. */
const STALE_MS = 6 * 3_600_000;

/** Space on each provider, what is offsite, and how much was verified per day. */
@Component({
  selector: 'app-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProviderCard, StatTile, ProviderChip, DailyChart],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.scss',
})
export class OverviewPage implements OnInit {
  private readonly data = inject(OffsiteData);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly providers = signal<Provider[]>([]);
  protected readonly totals = signal<ProviderTotals[]>([]);
  protected readonly daily = signal<DailyTotals[]>([]);
  protected readonly checking = signal<RemoteProviderId | null>(null);
  protected readonly loaded = signal(false);

  protected readonly allFiles = computed(() => this.totals().reduce((n, t) => n + t.files, 0));
  protected readonly allBytes = computed(() => this.totals().reduce((n, t) => n + t.bytes, 0));
  protected readonly bytes = bytes;
  protected readonly count = count;
  protected readonly ago = ago;

  async ngOnInit() {
    try {
      const [providers, totals, daily] = await Promise.all([
        this.data.providers(),
        this.data.totals(),
        this.data.daily(90),
      ]);
      this.providers.set(providers);
      this.totals.set(totals);
      this.daily.set(daily);
      this.loaded.set(true);
    } catch (e) {
      this.snack.open(`Could not load the overview: ${(e as Error).message}`, 'OK');
      return;
    }
    // Check space by itself when the last answer (good or failed) is stale, one provider at a time.
    for (const p of this.providers()) {
      const last = [p.space?.takenAt, p.lastError?.at].filter(Boolean).sort().pop();
      if (p.remote && (!last || Date.now() - Date.parse(last) > STALE_MS)) await this.checkSpace(p.id);
    }
  }

  /** Sign a remote in (or back in). On success the card shows the fresh space check. */
  async connect(p: Provider) {
    const done = await firstValueFrom(
      this.dialog.open(ConnectDialog, { data: p, width: '36rem' }).afterClosed(),
    );
    if (done) this.providers.update((list) => list.map((x) => (x.id === p.id ? done.provider : x)));
  }

  /** A failed check isn't a popup: the card shows the reason, which the API keeps as lastError. */
  async checkSpace(id: RemoteProviderId) {
    this.checking.set(id);
    try {
      const space = await this.data.checkSpace(id);
      this.providers.update((list) => list.map((p) => (p.id === id ? { ...p, space, lastError: null } : p)));
    } catch {
      try {
        this.providers.set(await this.data.providers());
      } catch (e) {
        this.snack.open(`Space check failed: ${(e as Error).message}`, 'OK');
      }
    } finally {
      this.checking.set(null);
    }
  }
}
