import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** For the dashboards, not the wrapper: copy this file into an Angular app as is. After every in-app navigation it
 *  tells the home-dashboards wrapper which page is open, so the wrapper's address bar shows it and a copied link
 *  opens the same screen (DASHBOARD-REQUIREMENTS 3.7).
 *
 *    providers: [provideRouteReporter(() => config.frameParents)]   // the /api/config list, read when it's needed
 *
 *  It posts only when framed, and only to the parent's own origin when that's one of frameParents (never '*'). */
export function provideRouteReporter(frameParents: () => readonly string[]): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (window.parent === window) return;
    const router = inject(Router);
    // withHashLocation: the page lives after the #, so /c/650 is reported as /#/c/650 (a bare /c/650 would 404)
    const prefix = inject(LocationStrategy) instanceof HashLocationStrategy ? '/#' : '';
    // the page that framed us: ancestorOrigins where the browser has it (Chrome, Safari), else the referrer (Firefox)
    const parent =
      location.ancestorOrigins?.[0] ?? (document.referrer && new URL(document.referrer).origin);
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      // router.url is the path + query + hash relative to <base href>, which is what the wrapper wants
      if (parent && frameParents().includes(parent))
        window.parent.postMessage({ type: 'route', path: prefix + router.url }, parent);
    });
  });
}
