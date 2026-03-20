import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { QuotesService } from '../../../core/services/quotes.service';
import type {
  QuoteAttachmentRequest,
  QuoteResponse,
  QuoteURLRequest,
} from '../../../core/services/quotes.types';
import type { AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import type { UrlDraft } from './offertes-create.models';

export interface AttachmentPreviewState {
  previewOpen: boolean;
  previewLoading: boolean;
  previewError: string | null;
  previewUrl: string | null;
  previewAttachment: AttachmentDraft | null;
}

export interface ManualUploadPlan {
  nextDrafts: AttachmentDraft[];
  upload$?: Observable<AttachmentDraft[]>;
}

export interface PreviewOpenPlan {
  state: AttachmentPreviewState;
  remoteUrl$?: Observable<string>;
}

@Injectable({ providedIn: 'root' })
export class OffertesCreateAttachmentsService {
  private readonly quotesService = inject(QuotesService);
  private readonly catalogService = inject(CatalogService);

  createManualDraft(file: File, sortOrder: number, createUid: () => string): AttachmentDraft {
    return {
      uid: createUid(),
      filename: file.name,
      fileKey: '',
      source: 'manual',
      enabled: true,
      sortOrder,
    };
  }

  createManualUploadPlan(input: {
    file: File;
    quoteId: string | null;
    drafts: AttachmentDraft[];
    createUid: () => string;
  }): ManualUploadPlan {
    const draft = this.createManualDraft(input.file, input.drafts.length, input.createUid);

    if (!input.quoteId) {
      return {
        nextDrafts: [...input.drafts, { ...draft, pendingFile: input.file }],
      };
    }

    const nextDrafts = [...input.drafts, { ...draft, uploading: true }];
    return {
      nextDrafts,
      upload$: this.uploadManualAttachment(input.quoteId, input.file).pipe(
        map((fileKey) => this.applyUploadedManualDraft(nextDrafts, draft.uid, fileKey)),
      ),
    };
  }

  uploadManualAttachment(quoteId: string, file: File): Observable<string> {
    return this.quotesService
      .presignAttachmentUpload(quoteId, {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })
      .pipe(
        switchMap((presigned) =>
          this.quotesService
            .uploadToPresignedUrl(presigned.uploadUrl, file)
            .pipe(map(() => presigned.fileKey)),
        ),
      );
  }

  markPendingUploads(items: AttachmentDraft[]): AttachmentDraft[] {
    return items.map((item) => (item.pendingFile ? { ...item, uploading: true } : item));
  }

  clearPendingUploadFlags(items: AttachmentDraft[]): AttachmentDraft[] {
    return items.map((item) => (item.pendingFile ? { ...item, uploading: false } : item));
  }

  removeDraft(items: AttachmentDraft[], uid: string): AttachmentDraft[] {
    return items.filter((item) => item.uid !== uid);
  }

  applyUploadedManualDraft(
    items: AttachmentDraft[],
    uid: string,
    fileKey: string,
  ): AttachmentDraft[] {
    return items.map((item) =>
      item.uid === uid ? { ...item, fileKey, uploading: false } : item,
    );
  }

  hasUploadsInProgress(items: AttachmentDraft[]): boolean {
    return items.some((item) => item.uploading);
  }

  uploadPendingDrafts(quoteId: string, drafts: AttachmentDraft[]): Observable<AttachmentDraft[]> {
    const pending = drafts.filter((attachment) => attachment.pendingFile);
    if (pending.length === 0) {
      return of(drafts);
    }

    const uploads = pending.map((attachment) => {
      const file = attachment.pendingFile;
      if (!file) {
        return of({ uid: attachment.uid, fileKey: '' });
      }

      return this.uploadManualAttachment(quoteId, file).pipe(
        map((fileKey) => ({ uid: attachment.uid, fileKey })),
      );
    });

    return forkJoin(uploads).pipe(
      map((results) => {
        const fileKeyByUid = new Map(results.map((result) => [result.uid, result.fileKey]));
        return drafts.map((item) => {
          const fileKey = fileKeyByUid.get(item.uid);
          if (!fileKey) {
            return item.pendingFile ? { ...item, uploading: false } : item;
          }

          const { pendingFile: _pendingFile, ...rest } = item;
          return { ...rest, fileKey, uploading: false };
        });
      }),
    );
  }

  saveAttachmentsToQuote(
    quoteId: string,
    attachmentDrafts: AttachmentDraft[],
    urlDrafts: UrlDraft[],
  ): Observable<QuoteResponse> {
    const attachments: QuoteAttachmentRequest[] = attachmentDrafts
      .filter((attachment) => attachment.fileKey && !attachment.pendingFile)
      .map((attachment, index) => ({
        filename: attachment.filename,
        fileKey: attachment.fileKey,
        source: attachment.source,
        ...(attachment.catalogProductId ? { catalogProductId: attachment.catalogProductId } : {}),
        enabled: attachment.enabled,
        sortOrder: index,
      }));

    const urls: QuoteURLRequest[] = urlDrafts.map((url) => ({
      label: url.label,
      href: url.href,
      ...(url.catalogProductId ? { catalogProductId: url.catalogProductId } : {}),
    }));

    return this.quotesService.update(quoteId, { attachments, urls });
  }

  buildPendingPreviewState(attachment: AttachmentDraft): AttachmentPreviewState {
    return {
      previewOpen: true,
      previewLoading: false,
      previewError: null,
      previewUrl: attachment.pendingFile ? URL.createObjectURL(attachment.pendingFile) : null,
      previewAttachment: attachment,
    };
  }

  buildRemotePreviewOpenPlan(
    attachment: AttachmentDraft,
    quoteId: string | null,
  ): PreviewOpenPlan | null {
    if (attachment.pendingFile) {
      return { state: this.buildPendingPreviewState(attachment) };
    }

    if (!quoteId) {
      return null;
    }

    return {
      state: {
        previewOpen: true,
        previewLoading: true,
        previewError: null,
        previewUrl: null,
        previewAttachment: attachment,
      },
      remoteUrl$: this.getRemotePreviewUrl(attachment, quoteId),
    };
  }

  buildRemotePreviewSuccessState(
    attachment: AttachmentDraft,
    downloadUrl: string,
  ): AttachmentPreviewState {
    return {
      previewOpen: true,
      previewLoading: false,
      previewError: null,
      previewUrl: downloadUrl,
      previewAttachment: attachment,
    };
  }

  buildRemotePreviewErrorState(
    attachment: AttachmentDraft,
    errorMessage: string,
  ): AttachmentPreviewState {
    return {
      previewOpen: true,
      previewLoading: false,
      previewError: errorMessage,
      previewUrl: null,
      previewAttachment: attachment,
    };
  }

  buildClosedPreviewState(currentUrl: string | null): AttachmentPreviewState {
    if (currentUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(currentUrl);
    }

    return {
      previewOpen: false,
      previewLoading: false,
      previewError: null,
      previewUrl: null,
      previewAttachment: null,
    };
  }

  getRemotePreviewUrl(attachment: AttachmentDraft, quoteId: string): Observable<string> {
    if (attachment.source === 'catalog' && attachment.catalogProductId && attachment.catalogAssetId) {
      return this.catalogService
        .getCatalogAssetDownloadUrl(attachment.catalogProductId, attachment.catalogAssetId)
        .pipe(map((response) => response.downloadUrl));
    }

    return this.quotesService
      .getAttachmentDownloadUrl(quoteId, attachment.uid)
      .pipe(map((response) => response.downloadUrl));
  }
}