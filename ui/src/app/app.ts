import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBar } from './features/shell/nav-bar';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavBar],
  template: `
    <app-nav-bar />
    <main><router-outlet /></main>
    <footer>
      Built by
      <a href="https://github.com/kananlanginhooper" target="_blank" rel="noopener">Kanan Hooper</a>
    </footer>
  `,
  styles: `
    :host { --nav-h: 48px; display: block; }
    main { padding: var(--app-space-4); max-width: 1400px; margin: 0 auto; }
    footer { padding: var(--app-space-4); text-align: center; color: var(--app-muted); font: var(--app-text-xs); }
    footer a { color: inherit; }
  `,
})
export class App {}
