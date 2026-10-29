import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Shown in place of a table or chart that has nothing to show (or failed to load). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `<mat-icon>{{ icon() }}</mat-icon><span>{{ text() }}</span>`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--app-space-2);
      padding: var(--app-space-6);
      color: var(--app-muted);
      font: var(--app-text-sm);
    }
  `,
})
export class EmptyState {
  readonly text = input.required<string>();
  readonly icon = input('inbox');
}
