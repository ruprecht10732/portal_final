import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import type { AttachmentSource } from '../../../core/services/quotes.types';

/** Local UI model for a single attachment row. */
export interface AttachmentDraft {
  /** Temporary local id for tracking. */
  uid: string;
  filename: string;
  fileKey: string;
  source: AttachmentSource;
  catalogProductId?: string;
  /** The original catalog asset ID — used for preview via catalog download endpoint. */
  catalogAssetId?: string;
  enabled: boolean;
  sortOrder: number;
  /** True while a manual upload is in progress. */
  uploading?: boolean;
  /** Holds the File object when upload is deferred (create mode). */
  pendingFile?: File;
}

@Component({
  selector: 'app-attachment-panel',
  imports: [TranslatePipe, LucideAngularModule, DragDropModule],
  templateUrl: './attachment-panel.component.html',
  styleUrl: './attachment-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentPanelComponent {
  private readonly translate = inject(TranslateService);

  /** Current list of attachment drafts (two-way bound). */
  attachments = input.required<AttachmentDraft[]>();

  /** Whether manual upload is allowed. */
  allowManualUpload = input(true);

  /** Emitted when the user wants to upload a manual PDF. */
  manualUploadRequested = output<File>();

  /** Emitted when any change occurs (reorder, toggle, remove). */
  attachmentsChanged = output<AttachmentDraft[]>();

  /** Emitted when the user clicks a filename to preview the attachment. */
  previewRequested = output<AttachmentDraft>();

  protected readonly dragDisabled = computed(() => this.attachments().length <= 1);

  protected toggle(uid: string): void {
    const updated = this.attachments().map(a =>
      a.uid === uid ? { ...a, enabled: !a.enabled } : a,
    );
    this.emitUpdate(updated);
  }

  protected remove(uid: string): void {
    const updated = this.attachments().filter(a => a.uid !== uid);
    this.emitUpdate(updated);
  }

  protected onDrop(event: CdkDragDrop<AttachmentDraft[]>): void {
    const items = [...this.attachments()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    // Recalculate sort order
    const updated = items.map((a, i) => ({ ...a, sortOrder: i }));
    this.emitUpdate(updated);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      if (file.type === 'application/pdf') {
        this.manualUploadRequested.emit(file);
      }
    }
    // Reset the input so re-selecting the same file triggers change
    input.value = '';
  }

  protected sourceLabel(source: AttachmentSource): string {
    return source === 'catalog'
      ? this.translate.instant('offertes.sourceCatalog')
      : this.translate.instant('offertes.sourceUpload');
  }

  private emitUpdate(items: AttachmentDraft[]): void {
    this.attachmentsChanged.emit(items);
  }
}
