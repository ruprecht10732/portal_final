import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteResponse } from '../../../core/services/quotes.types';
import type { AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import type { UrlDraft } from './offertes-create.models';
import { OffertesCreateAttachmentsService } from './offertes-create-attachments.service';
import { OffertesCreatePersistenceService } from './offertes-create-persistence.service';
import type { QuoteDraftPayload } from './offertes-create-quote.utils';

describe('OffertesCreatePersistenceService', () => {
  let service: OffertesCreatePersistenceService;
  let quotesService: {
    create: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let attachmentsService: {
    saveAttachmentsToQuote: ReturnType<typeof vi.fn>;
    uploadPendingDrafts: ReturnType<typeof vi.fn>;
  };

  const payload = {
    items: [],
    attachments: [],
    urls: [],
  } as unknown as QuoteDraftPayload;

  const buildQuoteResponse = (id: string): QuoteResponse => ({ id } as QuoteResponse);

  beforeEach(() => {
    quotesService = {
      create: vi.fn(),
      send: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    attachmentsService = {
      saveAttachmentsToQuote: vi.fn(),
      uploadPendingDrafts: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OffertesCreatePersistenceService,
        { provide: QuotesService, useValue: quotesService as unknown as QuotesService },
        { provide: OffertesCreateAttachmentsService, useValue: attachmentsService as unknown as OffertesCreateAttachmentsService },
      ],
    });

    service = TestBed.inject(OffertesCreatePersistenceService);
  });

  it('updates an existing draft without calling send', async () => {
    quotesService.update.mockReturnValue(of(buildQuoteResponse('quote-1')));

    const result = await firstValueFrom(service.saveExistingQuote({
      quoteId: 'quote-1',
      payload,
      status: 'Draft',
    }));

    expect(result).toBe('quote-1');
    expect(quotesService.update).toHaveBeenCalledWith('quote-1', payload);
    expect(quotesService.send).not.toHaveBeenCalled();
    expect(quotesService.updateStatus).not.toHaveBeenCalled();
  });

  it('sends an existing quote through the send endpoint after update', async () => {
    quotesService.update.mockReturnValue(of(buildQuoteResponse('quote-2')));
    quotesService.send.mockReturnValue(of(buildQuoteResponse('quote-2')));

    const result = await firstValueFrom(service.saveExistingQuote({
      quoteId: 'quote-2',
      payload,
      status: 'Sent',
    }));

    expect(result).toBe('quote-2');
    expect(quotesService.update).toHaveBeenCalledWith('quote-2', payload);
    expect(quotesService.send).toHaveBeenCalledWith('quote-2');
    expect(quotesService.updateStatus).not.toHaveBeenCalled();
  });

  it('surfaces send failures for an existing quote', async () => {
    quotesService.update.mockReturnValue(of(buildQuoteResponse('quote-3')));
    quotesService.send.mockReturnValue(throwError(() => new Error('send failed')));

    await expect(firstValueFrom(service.saveExistingQuote({
      quoteId: 'quote-3',
      payload,
      status: 'Sent',
    }))).rejects.toThrow('send failed');

    expect(quotesService.send).toHaveBeenCalledWith('quote-3');
    expect(quotesService.updateStatus).not.toHaveBeenCalled();
  });

  it('sends a newly created quote through the send endpoint when requested', async () => {
    const attachmentDrafts: AttachmentDraft[] = [];
    const urlDrafts: UrlDraft[] = [];
    quotesService.create.mockReturnValue(of(buildQuoteResponse('quote-4')));
    quotesService.send.mockReturnValue(of(buildQuoteResponse('quote-4')));

    const result = await firstValueFrom(service.createNewQuote({
      leadId: 'lead-1',
      payload,
      status: 'Sent',
      attachmentDrafts,
      urlDrafts,
    }));

    expect(result).toEqual({ quoteId: 'quote-4', attachmentDrafts });
    expect(quotesService.create).toHaveBeenCalledWith({ leadId: 'lead-1', ...payload });
    expect(quotesService.send).toHaveBeenCalledWith('quote-4');
    expect(quotesService.updateStatus).not.toHaveBeenCalled();
    expect(attachmentsService.uploadPendingDrafts).not.toHaveBeenCalled();
    expect(attachmentsService.saveAttachmentsToQuote).not.toHaveBeenCalled();
  });
});