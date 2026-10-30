import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { OffsiteData } from '../../core/data/offsite-data';
import type { JobRun, ProviderId } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { ProviderChip } from '../../shared/provider-chip';
import { StatusPill } from '../../shared/status-pill';
import { bytes, count, when } from '../../shared/format';
import { phoneWidth } from '../../shared/phone';

/** Push, restore and verify runs, newest first. */
@Component({
  selector: 'app-jobs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatProgressBarModule, ProviderChip, StatusPill, EmptyState],
  templateUrl: './jobs.page.html',
  styles: `
    :host { display: block; overflow-x: auto; }
    table { width: 100%; background: transparent; }
    .progress { min-width: 160px; }
    .muted { color: var(--app-muted); font: var(--app-text-xs); }
    .item { padding-top: var(--app-space-2); padding-bottom: var(--app-space-2); }
    .line { display: flex; flex-wrap: wrap; align-items: center; gap: var(--app-space-2); margin-bottom: var(--app-space-1); }
  `,
})
export class JobsPage implements OnInit {
  private readonly data = inject(OffsiteData);
  private readonly snack = inject(MatSnackBar);

  protected readonly rows = signal<JobRun[]>([]);
  private readonly phone = phoneWidth();
  /** Under 600 px each run is one stacked cell. */
  protected readonly columns = computed(() =>
    this.phone() ? ['item'] : ['kind', 'provider', 'status', 'progress', 'started', 'finished'],
  );
  protected readonly bytes = bytes;
  protected readonly count = count;
  protected readonly when = when;
  protected readonly asProvider = (p: string) => p as ProviderId;
  protected readonly pct = (j: JobRun) => (j.filesTotal ? (100 * j.filesDone) / j.filesTotal : 0);

  async ngOnInit() {
    try {
      this.rows.set(await this.data.jobs());
    } catch (e) {
      this.snack.open(`Could not load jobs: ${(e as Error).message}`, 'OK');
    }
  }
}
