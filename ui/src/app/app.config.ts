import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { ConfigService, frameParents } from './core/config.service';
import { OffsiteData } from './core/data/offsite-data';
import { DATA_SOURCE } from './core/data/mode';
import { routes } from './app.routes';
import { provideRouteReporter } from './shared/route-reporter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideEchartsCore({ echarts: () => import('echarts') }),
    { provide: OffsiteData, useClass: DATA_SOURCE },
    provideAppInitializer(() => inject(ConfigService).load()),
    // tells the home-dashboards wrapper which page is open, for shareable links
    provideRouteReporter(frameParents),
  ],
};
