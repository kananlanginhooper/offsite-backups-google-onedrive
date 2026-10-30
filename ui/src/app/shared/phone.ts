import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** True under 600 px, where tables switch to one stacked cell per row. Call in an injection context. */
export function phoneWidth(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 600px)')
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );
}
