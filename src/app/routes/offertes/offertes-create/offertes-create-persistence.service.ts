import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteDraftPayload } from './offertes-create-quote.utils';
import type { AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import type { UrlDraft } from './offertes-create.models';
import { OffertesCreateAttachmentsService } from './offertes-create-attachments.service';

@Injectable({ providedIn: 'root' })
export class OffertesCreatePersistenceService {
  private readonly quotesService = inject(QuotesService);
  private readonly attachmentsService = inject(OffertesCreateAttachmentsService);

  saveExistingQuote(input: {
    quoteId: string;
    payload: QuoteDraftPayload;
    status: 'Draft' | 'Sent';
  }): Observable<string> {
    return this.quotesService.update(input.quoteId, input.payload).pipe(
      switchMap((updated) => {
        if (input.status !== 'Sent') {
          return of(updated.id);
        }

        return this.quotesService.send(updated.id).pipe(map(() => updated.id));
      }),
    );
  }

  createNewQuote(input: {
    leadId: string;
    payload: QuoteDraftPayload;
    status: 'Draft' | 'Sent';
    attachmentDrafts: AttachmentDraft[];
    urlDrafts: UrlDraft[];
  }): Observable<{ quoteId: string; attachmentDrafts: AttachmentDraft[] }> {
    return this.quotesService.create({ leadId: input.leadId, ...input.payload }).pipe(
      switchMap((created) =>
        this.persistPendingQuoteAssets(created.id, input.attachmentDrafts, input.urlDrafts).pipe(
          switchMap((attachmentDrafts) => this.sendIfRequested(created.id, input.status).pipe(
            map(() => ({ quoteId: created.id, attachmentDrafts })),
          )),
        ),
      ),
    );
  }

  private persistPendingQuoteAssets(
    quoteId: string,
    attachmentDrafts: AttachmentDraft[],
    urlDrafts: UrlDraft[],
  ): Observable<AttachmentDraft[]> {
    const pending = attachmentDrafts.filter((draft) => draft.pendingFile);
    if (pending.length === 0) {
      return of(attachmentDrafts);
    }

    return this.attachmentsService.uploadPendingDrafts(quoteId, attachmentDrafts).pipe(
      switchMap((updatedDrafts) =>
        this.attachmentsService.saveAttachmentsToQuote(quoteId, updatedDrafts, urlDrafts).pipe(
          map(() => updatedDrafts),
        ),
      ),
    );
  }

  private sendIfRequested(quoteId: string, status: 'Draft' | 'Sent'): Observable<void> {
    if (status !== 'Sent') {
      return of(void 0);
    }

    return this.quotesService.send(quoteId).pipe(map(() => void 0));
  }
}