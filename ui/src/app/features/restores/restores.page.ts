import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OffsiteData } from '../../core/data/offsite-data';
import type { ProviderId, Restore } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { ProviderChip } from '../../shared/provider-chip';
import { StatusPill } from '../../shared/status-pill';
import { bytes, when } from '../../shared/format';

/** Restores asked for from the Copies screen, newest first. */
@Component({
  selector: 'app-restores-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule, ProviderChip, StatusPill, EmptyState],
  templateUrl: './restores.page.html',
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--app-space-3); overflow-x: auto; }
    header { display: flex; justify-content: space-between; align-items: center; }
    p { margin: 0; color: var(--app-muted); font: var(--app-text-sm); }
    table { width: 100%; background: transparent; }
    .path { font-family: var(--app-font-mono); font-size: 12px; }
    .err { color: var(--app-bad); font: var(--app-text-xs); }
  `,
})
export class RestoresPage implements OnInit {
  private readonly data = inject(OffsiteData);
  private readonly snack = inject(MatSnackBar);

  protected readonly rows = signal<Restore[]>([]);
  protected readonly columns = ['id', 'provider', 'remote', 'destination', 'status', 'size', 'requested'];
  protected readonly bytes = bytes;
  protected readonly when = when;
  protected readonly asProvider = (p: string) => p as ProviderId;

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.rows.set(await this.data.restores());
    } catch (e) {
      this.snack.open(`Could not load restores: ${(e as Error).message}`, 'OK');
    }
  }
}
