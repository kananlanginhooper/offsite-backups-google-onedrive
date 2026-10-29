import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OffsiteData } from '../../core/data/offsite-data';
import type { ConnectResult, ConnectStart, Provider } from '../../core/models';

/**
 * Signs a remote in (or back in). The provider's sign-in opens in a new tab; after approval the
 * provider sends that tab to rclone's helper address on the server's own loopback, which the
 * viewer's browser can't load. The viewer pastes that address here and the server finishes.
 * Closes with the result when the sign-in was saved.
 */
@Component({
  selector: 'app-connect-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Sign in to {{ provider.label }}</h2>
    <mat-dialog-content>
      @if (done(); as d) {
        <p class="ok">
          <mat-icon>check_circle</mat-icon>
          Signed in{{ d.account ? ' as ' + d.account : '' }}. The push jobs use this sign-in too.
        </p>
      } @else if (start(); as s) {
        <ol>
          <li>
            <a mat-flat-button [href]="s.authUrl" target="_blank" rel="noopener">
              <mat-icon>open_in_new</mat-icon> Open the {{ provider.label }} sign-in
            </a>
            <div class="muted">Sign in with the account this remote belongs to, and approve.</div>
          </li>
          <li>
            The new tab then ends on a page that can't be reached, at
            <code>{{ s.redirectUri }}</code>… That's expected. Copy that tab's whole address from the
            address bar and paste it here:
            <mat-form-field appearance="outline" class="url">
              <mat-label>Address of the page that didn't load</mat-label>
              <input matInput [(ngModel)]="pasted" [disabled]="busy()" (keyup.enter)="finish()" />
            </mat-form-field>
          </li>
        </ol>
      }
      @if (error(); as e) {
        <p class="error"><mat-icon>error_outline</mat-icon> {{ e }}</p>
      }
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (done()) {
        <button mat-flat-button [mat-dialog-close]="done()">Close</button>
      } @else {
        <button mat-button mat-dialog-close>Cancel</button>
        @if (start()) {
          <button mat-flat-button [disabled]="busy() || !pasted.trim()" (click)="finish()">Finish sign-in</button>
        } @else if (error()) {
          <button mat-flat-button (click)="begin()">Try again</button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: `
    ol { padding-left: 1.2rem; display: grid; gap: 1rem; }
    .url { width: 100%; margin-top: .5rem; }
    .muted { opacity: .7; font-size: .875rem; margin-top: .25rem; }
    code { word-break: break-all; }
    .ok, .error { display: flex; gap: .5rem; align-items: center; }
    .error { color: var(--mat-sys-error); }
  `,
})
export class ConnectDialog implements OnInit {
  protected readonly provider = inject<Provider>(MAT_DIALOG_DATA);
  private readonly data = inject(OffsiteData);
  private readonly ref = inject(MatDialogRef<ConnectDialog, ConnectResult>);

  protected readonly start = signal<ConnectStart | null>(null);
  protected readonly done = signal<ConnectResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected pasted = '';

  ngOnInit() {
    this.ref.disableClose = false;
    void this.begin();
  }

  protected async begin() {
    this.error.set(null);
    this.busy.set(true);
    try {
      this.start.set(await this.data.connectStart(this.provider.id));
    } catch (e) {
      this.error.set(message(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async finish() {
    if (!this.pasted.trim() || this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      this.done.set(await this.data.connectFinish(this.provider.id, this.pasted.trim()));
    } catch (e) {
      this.error.set(message(e));
      // a sign-in that was refused or is stale can't be finished: start a fresh one
      if (!/paste|not a web address|no sign-in code/i.test(this.error() ?? '')) this.start.set(null);
    } finally {
      this.busy.set(false);
    }
  }
}

function message(e: unknown): string {
  if (e instanceof HttpErrorResponse) return (e.error as { message?: string } | null)?.message ?? e.message;
  return (e as Error).message;
}
