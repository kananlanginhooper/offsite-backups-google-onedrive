import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { Copy } from '../../core/models';
import { PROVIDER_LABEL, bytes } from '../../shared/format';

/** Confirms a restore. Closes with true to go ahead. */
@Component({
  selector: 'app-restore-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Restore this file?</h2>
    <mat-dialog-content>
      <p>
        Copies <b>{{ copy.remotePath }}</b> ({{ bytes(copy.size) }}) down from
        {{ labels[copy.provider] }} into a new folder on the server.
      </p>
      <p>The offsite copy is only read, and nothing on the server is overwritten.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button [mat-dialog-close]="true">Restore</button>
    </mat-dialog-actions>
  `,
})
export class RestoreDialog {
  protected readonly copy = inject<Copy>(MAT_DIALOG_DATA);
  protected readonly labels = PROVIDER_LABEL;
  protected readonly bytes = bytes;
}
