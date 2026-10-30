import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Copy } from '../../core/models';
import { ProviderChip } from '../../shared/provider-chip';
import { bytes, when } from '../../shared/format';

/** The offsite copies, one per row, with a restore button. */
@Component({
  selector: 'app-copies-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule, ProviderChip],
  templateUrl: './copies-table.html',
  styleUrl: './copies-table.scss',
})
export class CopiesTable {
  readonly rows = input.required<Copy[]>();
  readonly restore = output<Copy>();

  /** Under 600 px each copy is one stacked cell (provider, path, size, date) plus the restore button. */
  private readonly phone = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 600px)')
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );
  protected readonly columns = computed(() =>
    this.phone() ? ['item', 'actions'] : ['provider', 'path', 'size', 'verified', 'hash', 'actions'],
  );
  protected readonly bytes = bytes;
  protected readonly when = when;
}
