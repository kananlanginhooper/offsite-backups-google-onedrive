import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { Provider } from '../../core/models';
import { ago, bytes } from '../../shared/format';

/** One provider's space: used of total, free, and when it was last checked. */
@Component({
  selector: 'app-provider-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './provider-card.html',
  styleUrl: './provider-card.scss',
})
export class ProviderCard {
  readonly provider = input.required<Provider>();
  readonly checking = input(false);
  readonly checkSpace = output<void>();

  protected readonly space = computed(() => this.provider().space);
  protected readonly usedPct = computed(() => {
    const s = this.space();
    return s?.totalBytes && s.usedBytes !== null ? (100 * s.usedBytes) / s.totalBytes : 0;
  });
  protected readonly bytes = bytes;
  protected readonly ago = ago;
}
