import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted'> = {
  succeeded: 'ok',
  running: 'warn',
  queued: 'muted',
  failed: 'bad',
};

/** A job or restore status as a small colored pill. */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ status() }}`,
  host: { '[class]': 'tone()' },
  styles: `
    :host {
      display: inline-block;
      padding: 1px var(--app-space-2);
      border-radius: 999px;
      font: var(--app-text-xs);
      border: 1px solid currentColor;
    }
    :host(.ok) { color: var(--app-ok); }
    :host(.warn) { color: var(--app-warn); }
    :host(.bad) { color: var(--app-bad); }
    :host(.muted) { color: var(--app-muted); }
  `,
})
export class StatusPill {
  readonly status = input.required<string>();
  protected readonly tone = computed(() => TONE[this.status()] ?? 'muted');
}
