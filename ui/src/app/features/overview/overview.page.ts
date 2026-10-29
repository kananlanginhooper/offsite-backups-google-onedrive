import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OffsiteData } from '../../core/data/offsite-data';
import type { DailyTotals, Provider, ProviderTotals, RemoteProviderId } from '../../core/models';
import { ProviderChip } from '../../shared/provider-chip';
import { StatTile } from '../../shared/stat-tile';
import { ago, bytes, count } from '../../shared/format';
import { DailyChart } from './daily-chart';
import { ProviderCard } from './provider-card';

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

  protected readonly providers = signal<Provider[]>([]);
  protected readonly totals = signal<ProviderTotals[]>([]);
  protected readonly daily = signal<DailyTotals[]>([]);
  protected readonly checking = signal<RemoteProviderId | null>(null);

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
    } catch (e) {
      this.snack.open(`Could not load the overview: ${(e as Error).message}`, 'OK');
    }
  }

  async checkSpace(id: RemoteProviderId) {
    this.checking.set(id);
    try {
      const space = await this.data.checkSpace(id);
      this.providers.update((list) => list.map((p) => (p.id === id ? { ...p, space } : p)));
    } catch (e) {
      this.snack.open(`Space check failed: ${(e as Error).message}`, 'OK');
    } finally {
      this.checking.set(null);
    }
  }
}
