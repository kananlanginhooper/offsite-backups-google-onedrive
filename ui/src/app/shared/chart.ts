import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ChartRedraw, Resizable } from './chart-redraw';

/** An ECharts chart that follows the system light/dark setting. appChartRedraw (the wrapper's shared piece)
 *  keeps it sized when the dashboard shell loads this page in a hidden iframe. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, ChartRedraw],
  template: `<div echarts [options]="options()" [theme]="dark() ? 'dark' : ''" [initOpts]="{ renderer: 'svg' }"
    [autoResize]="false" (chartInit)="chart.set($event)" [appChartRedraw]="chart()" class="chart"></div>`,
  styles: `
    :host { display: block; }
    .chart { height: var(--chart-height, 280px); }
  `,
})
export class Chart {
  readonly options = input.required<EChartsCoreOption>();
  protected readonly dark = signal(false);
  protected readonly chart = signal<Resizable | undefined>(undefined);

  constructor() {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.dark.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.dark.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }
}
