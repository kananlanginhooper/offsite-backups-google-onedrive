import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** App title plus a Material tab link per screen. */
@Component({
  selector: 'app-nav-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  template: `
    <span class="brand">Offsite backups</span>
    <nav mat-tab-nav-bar [tabPanel]="panel" mat-stretch-tabs="false" mat-align-tabs="start">
      @for (s of screens; track s.path) {
        <a mat-tab-link [routerLink]="s.path" routerLinkActive #rla="routerLinkActive" [active]="rla.isActive">{{
          s.title
        }}</a>
      }
    </nav>
    <mat-tab-nav-panel #panel />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);
      height: var(--nav-h);
      padding: 0 var(--app-space-4);
      background: var(--app-card);
      border-bottom: 1px solid var(--app-line);
    }
    .brand { font: var(--app-text-lg); margin-right: var(--app-space-3); white-space: nowrap; }
    /* phones: the dashboard shell names the tab already, so every screen's tab fits instead */
    @media (max-width: 600px) {
      :host { padding: 0 var(--app-space-2); }
      .brand { display: none; }
      nav { --mat-tab-header-label-text-size: 14px; }
      nav .mdc-tab { padding: 0 12px; min-width: 0; }
    }
    nav {
      flex: 1 1 auto;
      min-width: 0;
      border-bottom: 0;
      --mat-tab-header-divider-height: 0;
      --mat-tab-container-height: var(--nav-h);
    }
  `,
})
export class NavBar {
  protected readonly screens = [
    { path: 'overview', title: 'Overview' },
    { path: 'copies', title: 'Copies' },
    { path: 'restores', title: 'Restores' },
    { path: 'jobs', title: 'Jobs' },
  ];
}
