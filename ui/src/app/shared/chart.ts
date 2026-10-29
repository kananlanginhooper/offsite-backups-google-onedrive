import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';

/** An ECharts chart that follows the system light/dark setting. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="options()" [theme]="dark() ? 'dark' : ''" [initOpts]="{ renderer: 'svg' }" class="chart"></div>`,
  styles: `
    :host { display: block; }
    .chart { height: var(--chart-height, 280px); }
  `,
})
export class Chart {
  readonly options = input.required<EChartsCoreOption>();
  protected readonly dark = signal(false);

  constructor() {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.dark.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.dark.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }
}
