import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  protected readonly columns = ['provider', 'path', 'size', 'verified', 'hash', 'actions'];
  protected readonly bytes = bytes;
  protected readonly when = when;
}
