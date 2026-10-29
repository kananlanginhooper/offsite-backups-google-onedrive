import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ProviderId } from '../core/models';
import { PROVIDER_COLOR, PROVIDER_LABEL } from './format';

/** A provider name with its color dot. */
@Component({
  selector: 'app-provider-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="dot" [style.background]="color()"></span>{{ label() }}`,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--app-space-2); white-space: nowrap; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
  `,
})
export class ProviderChip {
  readonly provider = input.required<ProviderId>();
  protected readonly label = computed(() => PROVIDER_LABEL[this.provider()]);
  protected readonly color = computed(() => PROVIDER_COLOR[this.provider()]);
}
