import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';

/** An ECharts chart that follows the system light/dark setting. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="options()" [theme]="dark() ? 'dark' : ''" [initOpts]="{ renderer: 'svg' }"
    (chartInit)="onInit($event)" class="chart"></div>`,
  styles: `
    :host { display: block; }
    .chart { height: var(--chart-height, 280px); }
  `,
})
export class Chart {
  readonly options = input.required<EChartsCoreOption>();
  protected readonly dark = signal(false);
  private chart?: ECharts;
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    this.dark.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.dark.set(e.matches);
    mq.addEventListener('change', onChange);

    // A dashboard shell can load this page in a hidden iframe: the chart is then drawn 0 px wide,
    // and ngx-echarts' own resize waits for an animation frame a hidden page never gets. Redraw
    // directly whenever the box changes size, so the chart appears the moment the tab is shown.
    const ro = new ResizeObserver(() => this.fit());
    ro.observe(this.host);
    inject(DestroyRef).onDestroy(() => {
      mq.removeEventListener('change', onChange);
      ro.disconnect();
    });
  }

  protected onInit(chart: ECharts): void {
    this.chart = chart;
    this.fit();
  }

  private fit(): void {
    if (this.chart && this.host.clientWidth > 0) this.chart.resize();
  }
}
