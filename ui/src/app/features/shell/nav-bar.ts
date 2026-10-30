import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

/** App title plus a Material tab link per screen. The strip scrolls by finger (no paging arrows). */
@Component({
  selector: 'app-nav-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  template: `
    <span class="brand">Offsite backups</span>
    <nav mat-tab-nav-bar [tabPanel]="panel" [disablePagination]="true" mat-stretch-tabs="false" mat-align-tabs="start">
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
      nav .mdc-tab { padding: 0 12px; min-width: 44px; }
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // keep the current screen's tab in view after each navigation
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() =>
        requestAnimationFrame(() => {
          const links = [...this.host.nativeElement.querySelectorAll<HTMLElement>('a[mat-tab-link]')];
          const i = this.screens.findIndex((s) => location.pathname.endsWith(`/${s.path}`));
          links[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }),
      );
  }

  protected readonly screens = [
    { path: 'overview', title: 'Overview' },
    { path: 'copies', title: 'Copies' },
    { path: 'restores', title: 'Restores' },
    { path: 'jobs', title: 'Jobs' },
  ];
}
