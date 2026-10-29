import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A labeled number with an optional note under it. */
@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="label">{{ label() }}</div>
    <div class="value">{{ value() }}</div>
    @if (note()) {
      <div class="note">{{ note() }}</div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: var(--app-space-4);
      background: var(--app-card);
      border: 1px solid var(--app-line);
      border-radius: var(--app-radius-m);
    }
    .label { font: var(--app-text-sm); color: var(--app-muted); }
    .value { font: var(--app-text-2xl); margin-top: var(--app-space-1); }
    .note { font: var(--app-text-xs); color: var(--app-muted); margin-top: var(--app-space-1); }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input<string>('');
}
