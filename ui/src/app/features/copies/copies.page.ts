import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { OffsiteData } from '../../core/data/offsite-data';
import type { Copy, ProviderId } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { CopiesTable } from './copies-table';
import { CopyFilters } from './copy-filters';
import { RestoreDialog } from './restore-dialog';

/** Browse every offsite copy and restore one. */
@Component({
  selector: 'app-copies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopyFilters, CopiesTable, EmptyState, MatPaginatorModule, MatProgressBarModule],
  template: `
    <app-copy-filters
      [provider]="provider()"
      [query]="query()"
      (providerChange)="setProvider($event)"
      (queryChange)="setQuery($event)"
    />
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (rows().length) {
      <app-copies-table [rows]="rows()" (restore)="restore($event)" />
    } @else if (!loading()) {
      <app-empty-state text="No offsite copies match" icon="cloud_off" />
    }
    <mat-paginator
      [length]="total()"
      [pageIndex]="page()"
      [pageSize]="size()"
      [pageSizeOptions]="[25, 50, 100, 250]"
      (page)="setPage($event)"
    />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--app-space-3); }
    mat-paginator { background: transparent; }
  `,
})
export class CopiesPage implements OnInit {
  private readonly data = inject(OffsiteData);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly provider = signal<ProviderId | undefined>(undefined);
  protected readonly query = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(50);
  protected readonly rows = signal<Copy[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  ngOnInit() {
    void this.load();
  }

  setProvider(p: ProviderId | undefined) {
    this.provider.set(p);
    this.page.set(0);
    void this.load();
  }

  setQuery(q: string) {
    this.query.set(q);
    this.page.set(0);
    void this.load();
  }

  setPage(e: PageEvent) {
    this.page.set(e.pageIndex);
    this.size.set(e.pageSize);
    void this.load();
  }

  async restore(copy: Copy) {
    const ok = await firstValueFrom(this.dialog.open(RestoreDialog, { data: copy }).afterClosed());
    if (!ok) return;
    try {
      const r = await this.data.restore(copy.id);
      this.snack.open(`Restore ${r.id} started: ${r.destination}`, 'OK', { duration: 6000 });
    } catch (e) {
      this.snack.open(`Restore failed: ${(e as Error).message}`, 'OK');
    }
  }

  private async load() {
    this.loading.set(true);
    try {
      const res = await this.data.copies({
        provider: this.provider(),
        q: this.query(),
        skip: this.page() * this.size(),
        take: this.size(),
      });
      this.rows.set(res.items);
      this.total.set(res.total);
    } catch (e) {
      this.snack.open(`Could not load copies: ${(e as Error).message}`, 'OK');
    } finally {
      this.loading.set(false);
    }
  }
}
