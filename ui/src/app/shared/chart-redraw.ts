import {
  Directive,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';

/** Anything with a resize(): an ECharts instance, or another chart library's. */
export interface Resizable {
  resize(): void;
}

/** Wait this long after the last size change before redrawing (a drag-resize fires many). */
const SETTLE_MS = 100;

/** Keeps a chart sized to its box inside the wrapper's iframes. A tab the wrapper isn't showing gets no animation
 *  frames, and ngx-echarts' autoResize waits for one, so a chart drawn or resized while its tab was hidden stays the
 *  wrong size (often 0 wide) until something else redraws it. This calls resize() straight from a ResizeObserver and
 *  again when the page becomes visible. Copy this file into an app as is.
 *
 *    <div echarts [options]="opts()" [autoResize]="false" (chartInit)="chart.set($event)"
 *         [appChartRedraw]="chart()"></div>
 *
 *  with `chart = signal<Resizable | undefined>(undefined)` in the component. Give the div a height (CSS). */
@Directive({
  selector: '[appChartRedraw]',
  host: { '(document:visibilitychange)': 'redraw()' },
})
export class ChartRedraw implements OnDestroy {
  readonly appChartRedraw = input<Resizable | null | undefined>();
  private readonly box = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer?: ResizeObserver;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    // the chart may come up after the box got its size (it was created in a hidden tab)
    effect(() => {
      if (this.appChartRedraw()) untracked(() => this.redraw());
    });
    afterNextRender(() => {
      this.observer = new ResizeObserver(() => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.redraw(), SETTLE_MS);
      });
      this.observer.observe(this.box);
    });
  }

  /** Resize now; a no-op while the box has no size (display: none) or the chart isn't up yet. */
  redraw(): void {
    if (this.box.offsetWidth && this.box.offsetHeight) this.appChartRedraw()?.resize();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.timer);
  }
}
