import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { DailyTotals, ProviderId } from '../../core/models';
import { Chart } from '../../shared/chart';
import { EmptyState } from '../../shared/empty-state';
import { PROVIDER_COLOR, PROVIDER_LABEL, bytes } from '../../shared/format';

/** Verified bytes per day, stacked by provider. */
@Component({
  selector: 'app-daily-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chart, EmptyState],
  template: `
    @if (rows().length) {
      <app-chart [options]="options()" />
    } @else {
      <app-empty-state text="No verified copies in this period" icon="bar_chart" />
    }
  `,
})
export class DailyChart {
  readonly rows = input.required<DailyTotals[]>();

  protected readonly options = computed<EChartsCoreOption>(() => {
    const rows = this.rows();
    const days = [...new Set(rows.map((r) => r.day))].sort();
    const providers = [...new Set(rows.map((r) => r.provider))] as ProviderId[];
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v: number) => bytes(v),
      },
      legend: { top: 0 },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: days },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => bytes(v) } },
      series: providers.map((p) => ({
        name: PROVIDER_LABEL[p],
        type: 'bar',
        stack: 'bytes',
        itemStyle: { color: PROVIDER_COLOR[p] },
        data: days.map((d) => rows.find((r) => r.day === d && r.provider === p)?.bytes ?? 0),
      })),
    };
  });
}
