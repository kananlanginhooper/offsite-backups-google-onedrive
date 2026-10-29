import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { ProviderId } from '../../core/models';
import { PROVIDER_LABEL } from '../../shared/format';

/** Provider filter plus a search box (hash prefix or part of the path). */
@Component({
  selector: 'app-copy-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label>Provider</mat-label>
      <mat-select [value]="provider()" (valueChange)="providerChange.emit($event)">
        <mat-option [value]="undefined">All</mat-option>
        @for (p of providers; track p) {
          <mat-option [value]="p">{{ labels[p] }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    <mat-form-field subscriptSizing="dynamic" class="search">
      <mat-label>Search hash or path</mat-label>
      <input matInput [value]="query()" (keyup.enter)="queryChange.emit(box.value)" #box />
    </mat-form-field>
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: var(--app-space-3); }
    .search { flex: 1; min-width: 240px; }
  `,
})
export class CopyFilters {
  readonly provider = input<ProviderId | undefined>();
  readonly query = input('');
  readonly providerChange = output<ProviderId | undefined>();
  readonly queryChange = output<string>();

  protected readonly providers: ProviderId[] = ['gdrive', 'gphotos', 'onedrive'];
  protected readonly labels = PROVIDER_LABEL;
}
