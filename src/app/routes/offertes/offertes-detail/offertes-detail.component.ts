import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import { LeadsService } from '../../../core/services/leads.service';
import { SSEService } from '../../../core/services/sse.service';
import type {
  QuoteResponse,
  QuoteStatus,
  QuoteItemResponse,
  QuoteVersionHistoryResponse,
  QuoteVersionDiffItemResponse,
  QuoteVersionItemResponse,
} from '../../../core/services/quotes.types';
import {
  MONEYBIRD_PROVIDER,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  centsToEuros,
  formatQuantityAndPrice,
  derivePostcodePrefixZip4,
} from '../../../core/services/quotes.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateValue } from '../../../core/utils/date-utils';
import type { Lead } from '../../../core/services/leads.types';
import { UserService } from '../../../core/services/user.service';
import { CrossOrgTransferService, type TransferDestinationAccount } from '../../../core/services/cross-org-transfer.service';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ExtendQuoteDialogComponent } from '../../../shared/components/extend-quote-dialog/extend-quote-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../../../shared/components/menu/menu.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { QuotePricingIntelligencePanelComponent } from '../quote-pricing-intelligence-panel/quote-pricing-intelligence-panel.component';
import {
  SplitActionComponent,
  type SplitMenuItem,
  type SplitMenuSection,
} from '../../../shared/components/split-action/split-action.component';

interface LeadServiceOption {
  label: string;
  value: string;
}

interface QuoteLineageSummary {
  kind: 'duplicate' | 'version';
  title: string;
  body: string;
  sourceQuoteId: string;
  sourceQuoteNumber: string;
}

@Component({
  selector: 'app-offertes-detail',
  imports: [
    TranslatePipe,
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
    ExtendQuoteDialogComponent,
    PageHeaderComponent,
    MenuComponent,
    SelectComponent,
    SafeHtmlPipe,
    QuotePricingIntelligencePanelComponent,
    SplitActionComponent,
  ],
  templateUrl: './offertes-detail.component.html',
  styleUrl: './offertes-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class OffertesDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly leadsService = inject(LeadsService);
  private readonly translate = inject(TranslateService);
  private readonly sse = inject(SSEService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);
  private readonly transferService = inject(CrossOrgTransferService);

  private readonly currentUser = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected readonly loading = signal(true);
  protected readonly quote = signal<QuoteResponse | null>(null);
  protected readonly lead = signal<Lead | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly showExtendDialog = signal(false);
  protected readonly extendingQuote = signal(false);
  protected readonly versionHistory = signal<QuoteVersionHistoryResponse | null>(null);
  protected readonly loadingVersionHistory = signal(false);
  protected readonly updating = signal(false);
  protected readonly sending = signal(false);
  protected readonly duplicating = signal(false);
  protected readonly creatingVersion = signal(false);
  protected readonly downloadingPdf = signal(false);
  
  // Transfer State
  protected readonly showTransferDialog = signal(false);
  protected readonly transferDestinations = signal<TransferDestinationAccount[]>([]);
  protected readonly transferDestinationsLoading = signal(false);
  protected readonly transferDestinationUID = signal<string | null>(null);
  protected readonly transferError = signal<string | null>(null);
  protected readonly transferringQuote = signal(false);
  protected readonly transferDestinationOptions = computed<SelectOption<string>[]>(() =>
    this.transferDestinations().map(d => ({ value: d.uid, label: d.organizationName }))
  );

  // External Integrations State
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly loadingPreview = signal(false);
  protected readonly moneybirdConnected = signal(false);
  protected readonly exportingToMoneybird = signal(false);
  protected readonly moneybirdExported = signal(false);
  protected readonly moneybirdExternalUrl = signal<string | null>(null);

  // Computed Business Rules
  protected readonly isAdmin = computed(() => this.currentUser()?.roles?.includes('admin') ?? false);
  protected readonly canCreateVersion = computed(() => ['Draft', 'Sent'].includes(this.quote()?.status ?? ''));
  protected readonly canExtendQuote = computed(() => ['Sent', 'Accepted'].includes(this.quote()?.status ?? ''));
  
  protected readonly lineageSummary = computed<QuoteLineageSummary | null>(() => {
    const q = this.quote();
    if (!q) return null;
    
    if (q.previousVersionQuoteId && q.previousVersionQuoteNumber) {
      return {
        kind: 'version',
        title: this.translate.instant('offertes.lineage.versionTitle', { version: q.versionNumber }),
        body: this.translate.instant('offertes.lineage.versionBody', { quoteNumber: q.previousVersionQuoteNumber }),
        sourceQuoteId: q.previousVersionQuoteId,
        sourceQuoteNumber: q.previousVersionQuoteNumber,
      };
    }
    if (q.duplicatedFromQuoteId && q.duplicatedFromQuoteNumber) {
      return {
        kind: 'duplicate',
        title: this.translate.instant('offertes.lineage.duplicateTitle'),
        body: this.translate.instant('offertes.lineage.duplicateBody', { quoteNumber: q.duplicatedFromQuoteNumber }),
        sourceQuoteId: q.duplicatedFromQuoteId,
        sourceQuoteNumber: q.duplicatedFromQuoteNumber,
      };
    }
    return null;
  });

  protected readonly versionSummaries = computed(() => this.versionHistory()?.versions ?? []);
  protected readonly versionDiff = computed(() => this.versionHistory()?.diff ?? null);

  // Lead service linking
  protected readonly selectedLeadServiceId = signal<string | null>(null);
  protected readonly savingLeadService = signal(false);
  protected readonly leadServiceOptions = computed<LeadServiceOption[]>(() => 
    (this.lead()?.services ?? []).map(s => ({ label: s.serviceType, value: s.id }))
  );
  protected readonly pricingIntelligenceServiceType = computed(() => {
    const lead = this.lead();
    const serviceId = this.selectedLeadServiceId();
    return lead && serviceId ? lead.services.find(s => s.id === serviceId)?.serviceType ?? null : null;
  });
  protected readonly pricingIntelligencePostcodePrefix = computed(() =>
    derivePostcodePrefixZip4(this.lead()?.address.zipCode ?? this.quote()?.customerAddressZipCode)
  );

  // Annotations / Replies
  protected readonly replyTexts = signal<Record<string, string>>({});
  protected readonly replyingItemId = signal<string | null>(null);
  protected readonly draftingReplyItemId = signal<string | null>(null);
  protected readonly realtimeEvents = signal<{ type: string; message: string; time: Date }[]>([]);

  // --- Declarative Menus ---

  protected readonly mobileMenuSections = computed<readonly MenuSection[]>(() => {
    const q = this.quote();
    if (!q) return [];

    const items: (MenuItem | null)[] = [
      q.status === 'Draft' ? { label: 'offertes.markSent', disabled: this.updating() } : null,
      { label: 'offertes.transfer.action', disabled: !this.isAdmin() },
      this.canExtendQuote() ? { label: 'offertes.extend', disabled: this.extendingQuote() } : null,
      { label: 'offertes.duplicate' },
      { label: 'offertes.newVersion', disabled: !this.canCreateVersion() },
      { label: 'offertes.preview', disabled: !this.previewUrl() },
      { label: 'offertes.downloadPdf', disabled: !q.pdfFileKey },
      { label: 'offertes.partnerOffer.title', disabled: !(q.status === 'Accepted' && !!q.leadServiceId) },
      { label: 'common.delete' },
    ];

    return [{ items: items.filter((item): item is MenuItem => item !== null) }];
  });

  protected readonly desktopActionMenuSections = computed<readonly SplitMenuSection[]>(() => {
    const q = this.quote();
    if (!q) return [];

    let moneybirdItem: SplitMenuItem | null = null;
    if (q.status === 'Accepted' && this.moneybirdConnected()) {
      if (this.moneybirdExported()) {
        moneybirdItem = { label: 'offertes.viewInMoneybird', action: 'viewInMoneybird', icon: 'external-link' };
      } else {
        moneybirdItem = { label: 'offertes.sendToMoneybird', action: 'sendToMoneybird', icon: 'send', disabled: this.exportingToMoneybird() };
      }
    }

    const items: (SplitMenuItem | null)[] = [
      q.status === 'Draft' ? { label: 'offertes.edit', action: 'edit', icon: 'pencil' } : null,
      q.status === 'Draft' ? { label: 'offertes.markSent', action: 'markSent', icon: 'send', disabled: this.updating() } : null,
      this.isAdmin() ? { label: 'offertes.transfer.action', action: 'transfer', icon: 'send' } : null,
      { label: 'offertes.duplicate', action: 'duplicate', icon: 'copy', disabled: this.duplicating() },
      this.canExtendQuote() ? { label: 'offertes.extend', action: 'extend', icon: 'clock', disabled: this.extendingQuote() } : null,
      this.canCreateVersion() ? { label: 'offertes.newVersion', action: 'newVersion', icon: 'git-branch', disabled: this.creatingVersion() } : null,
      (q.status === 'Accepted' && !!q.leadServiceId) ? { label: 'offertes.partnerOffer.title', action: 'partnerOffer', icon: 'handshake' } : null,
      this.previewUrl() ? { label: 'offertes.preview', action: 'preview', icon: 'eye' } : null,
      q.pdfFileKey ? { label: 'offertes.downloadPdf', action: 'downloadPdf', icon: 'download', disabled: this.downloadingPdf() } : null,
      moneybirdItem,
      { label: 'common.delete', action: 'delete', icon: 'trash-2', tone: 'danger' },
    ];

    return [{ items: items.filter((item): item is SplitMenuItem => item !== null) }];
  });

  // --- Lifecycle & Initialization ---

  ngOnInit(): void {
    this.showPostSaveFeedbackToast();
    this.loadMoneybirdConnectionStatus();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadQuote(id);
      this.loadActivityHistory(id);
      this.listenForSSEEvents(id);
    } else {
      void this.router.navigate(['/app/offertes']);
    }
  }

  private showPostSaveFeedbackToast(): void {
    const state = (this.router.currentNavigation()?.extras.state ?? globalThis.history.state ?? null) as { aiFeedbackCount?: number } | null;
    const feedbackCount = typeof state?.aiFeedbackCount === 'number' ? state.aiFeedbackCount : 0;
    
    if (feedbackCount < 1) return;

    const translationKey = feedbackCount === 1 ? 'offertes.aiFeedbackCapturedSingle' : 'offertes.aiFeedbackCapturedMultiple';
    this.toast.success(this.translate.instant(translationKey, { count: feedbackCount }));

    const nextState: Record<string, unknown> = { ...(globalThis.history.state as Record<string, unknown>) };
    delete nextState['aiFeedbackCount'];
    globalThis.history.replaceState(nextState, document.title, this.router.url);
  }

  private loadQuote(id: string): void {
    this.loading.set(true);
    this.quotesService.getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: quote => {
          if (!quote) {
            this.error.set(this.translate.instant('offertes.errors.notFound'));
            return;
          }
          this.quote.set(quote);
          this.selectedLeadServiceId.set(quote.leadServiceId ?? null);
          
          // Fire off background fetches
          this.loadVersionHistory(quote.id);
          this.loadPreviewLink(quote);
          this.loadMoneybirdExportStatus(quote.id);
          if (quote.leadId) this.loadLead(quote.leadId);
        },
        error: () => {
          this.versionHistory.set(null);
          this.error.set(this.translate.instant('offertes.errors.loadQuote'));
        },
      });
  }

  private loadLead(id: string): void {
    this.leadsService.getById(id).subscribe({
      next: lead => this.lead.set(lead),
      error: () => this.toast.error(this.translate.instant('offertes.errors.loadLead')),
    });
  }

  private loadVersionHistory(id: string): void {
    this.loadingVersionHistory.set(true);
    this.quotesService.getVersionHistory(id)
      .pipe(finalize(() => this.loadingVersionHistory.set(false)))
      .subscribe({
        next: history => this.versionHistory.set(history),
        error: () => this.versionHistory.set(null),
      });
  }

  private loadPreviewLink(q: QuoteResponse): void {
    this.loadingPreview.set(true);
    this.quotesService.getPreviewLink(q.id)
      .pipe(finalize(() => this.loadingPreview.set(false)))
      .subscribe({
        next: response => this.previewUrl.set(this.buildPreviewUrl(response.token)),
        error: () => this.previewUrl.set(null),
      });
  }

  private loadActivityHistory(quoteId: string): void {
    this.quotesService.getActivities(quoteId).subscribe({
      next: activities => {
        this.realtimeEvents.set(activities.map(a => ({
          type: a.eventType,
          message: a.message,
          time: new Date(a.createdAt),
        })));
      }
    });
  }

  private listenForSSEEvents(quoteId: string): void {
    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const data = event.data;
        if (data?.['quoteId'] !== quoteId) return;

        const payload = data?.['payload'] as Record<string, unknown> | undefined;
        let message = '';
        let requiresReload = false;

        switch (event.type) {
          case 'quote_sent':
            message = 'Offerte verstuurd naar de klant';
            break;
          case 'quote_viewed':
            message = 'Klant heeft de offerte geopend';
            break;
          case 'quote_item_toggled': {
            const itemDesc = typeof payload?.['itemDescription'] === 'string' ? payload['itemDescription'] : 'een item';
            message = `Klant heeft '${itemDesc}' ${payload?.['isSelected'] ? 'ingeschakeld' : 'uitgeschakeld'}`;
            requiresReload = true;
            break;
          }
          case 'quote_annotated':
            message = `Nieuwe vraag: "${(payload?.['text'] as string)?.substring(0, 50) ?? ''}"`;
            requiresReload = true;
            break;
          case 'quote_accepted':
            message = `Offerte geaccepteerd door ${typeof payload?.['signatureName'] === 'string' ? payload['signatureName'] : 'klant'}`;
            requiresReload = true;
            break;
          case 'quote_rejected':
            message = 'Offerte afgewezen door klant';
            requiresReload = true;
            break;
          default:
            return;
        }

        if (requiresReload) this.loadQuote(quoteId);

        this.realtimeEvents.update(events => [
          { type: event.type, message, time: new Date() },
          ...events.slice(0, 19),
        ]);
      });
  }

  // --- Centralized Error Handler ---
  
  private handleOperationError(err: unknown, fallbackKey: string): void {
    const message = extractErrorMessage(err, this.translate.instant(fallbackKey), {
      allowErrorMessage: true,
      allowMessageField: true,
    });
    this.toast.error(message);
    this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
  }

  // --- Quote Interactions ---

  protected goBack(): void {
    void this.router.navigate(['/app/offertes']);
  }

  protected updateReplyText(itemId: string, text: string): void {
    this.replyTexts.update(prev => ({ ...prev, [itemId]: text }));
  }

  protected canSuggestReply(item: QuoteItemResponse): boolean {
    return item.annotations.some(annotation => annotation.authorType === 'customer');
  }

  protected suggestReply(itemId: string): void {
    const q = this.quote();
    if (!q || this.draftingReplyItemId() === itemId) return;

    this.draftingReplyItemId.set(itemId);
    this.quotesService.suggestAnnotationReplyDraft(q.id, itemId)
      .pipe(finalize(() => this.draftingReplyItemId.set(null)))
      .subscribe({
        next: draft => this.replyTexts.update(prev => ({ ...prev, [itemId]: draft.text })),
        error: err => this.handleOperationError(err, 'offertes.errors.replyDraft'),
      });
  }

  protected submitReply(itemId: string): void {
    const q = this.quote();
    const text = (this.replyTexts()[itemId] ?? '').trim();
    if (!q || !text) return;

    this.replyingItemId.set(itemId);
    this.quotesService.annotateItem(q.id, itemId, text)
      .pipe(finalize(() => this.replyingItemId.set(null)))
      .subscribe({
        next: () => {
          this.replyTexts.update(prev => ({ ...prev, [itemId]: '' }));
          this.loadQuote(q.id);
        }
      });
  }

  protected saveLeadServiceLink(): void {
    const q = this.quote();
    const leadServiceId = this.selectedLeadServiceId();
    if (!q || !leadServiceId || q.leadServiceId === leadServiceId) return;

    this.savingLeadService.set(true);
    this.quotesService.setLeadServiceId(q.id, leadServiceId)
      .pipe(finalize(() => this.savingLeadService.set(false)))
      .subscribe({
        next: updated => {
          this.quote.set(updated);
          this.selectedLeadServiceId.set(updated.leadServiceId ?? null);
          this.toast.success(this.translate.instant('common.saved'));
        },
        error: err => this.handleOperationError(err, 'common.error'),
      });
  }

  protected updateStatus(status: QuoteStatus): void {
    const q = this.quote();
    if (!q) return;

    this.updating.set(true);
    this.quotesService.updateStatus(q.id, status)
      .pipe(finalize(() => this.updating.set(false)))
      .subscribe({
        next: updated => {
          if (updated) {
            this.quote.set(updated);
            this.loadPreviewLink(updated);
          }
        }
      });
  }

  protected sendProposal(): void {
    const q = this.quote();
    if (!q) return;

    this.sending.set(true);
    this.quotesService.send(q.id)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: updated => {
          if (updated) {
            this.quote.set(updated);
            this.loadPreviewLink(updated);
          }
        },
        error: err => this.handleOperationError(err, 'common.error'),
      });
  }

  protected extendQuote(data: { extendDays: number }): void {
    const q = this.quote();
    if (!q || !this.canExtendQuote() || this.extendingQuote()) return;

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + data.extendDays);
    const validUntil = newDate.toISOString().split('T')[0]!;

    this.extendingQuote.set(true);
    this.quotesService.update(q.id, { validUntil })
      .pipe(finalize(() => this.extendingQuote.set(false)))
      .subscribe({
        next: updated => {
          this.quote.set(updated);
          this.showExtendDialog.set(false);
          this.toast.success(this.translate.instant('offertes.extendSuccess', { date: validUntil }));
        },
        error: err => this.handleOperationError(err, 'common.error'),
      });
  }

  protected duplicateQuote(): void {
    const q = this.quote();
    if (!q || this.duplicating()) return;

    this.duplicating.set(true);
    this.quotesService.duplicate(q.id)
      .pipe(finalize(() => this.duplicating.set(false)))
      .subscribe({
        next: duplicated => {
          this.toast.success(this.translate.instant('offertes.duplicateSuccess', { quoteNumber: duplicated.quoteNumber }));
          void this.router.navigate(['/app/offertes', duplicated.id, 'edit']);
        },
        error: err => this.handleOperationError(err, 'offertes.errors.duplicate'),
      });
  }

  protected createNewVersion(): void {
    const q = this.quote();
    if (!q || !this.canCreateVersion() || this.creatingVersion()) return;

    this.creatingVersion.set(true);
    this.quotesService.createVersion(q.id)
      .pipe(finalize(() => this.creatingVersion.set(false)))
      .subscribe({
        next: created => {
          this.toast.success(this.translate.instant('offertes.newVersionSuccess', { quoteNumber: created.quoteNumber }));
          void this.router.navigate(['/app/offertes', created.id, 'edit']);
        },
        error: err => this.handleOperationError(err, 'offertes.errors.newVersion'),
      });
  }

protected confirmTransferQuote(): void {
    const quote = this.quote();
    const destinationUID = this.transferDestinationUID();
    if (!quote || !destinationUID || this.transferringQuote()) return;

    this.transferringQuote.set(true);
    this.transferError.set(null);

    // FIX: Restored this.lead() as the second argument to match your service signature
    this.transferService.transferQuote(quote, this.lead(), destinationUID)
      .pipe(finalize(() => this.transferringQuote.set(false)))
      .subscribe({
        next: result => {
          this.showTransferDialog.set(false);
          const successKey = result.sourceLeadDeleted ? 'offertes.transfer.successLeadDeleted' : 'offertes.transfer.successServiceOnly';
          this.toast.success(this.translate.instant(successKey, { organization: result.destination.organizationName }));
          void this.router.navigate(['/app/offertes']);
        },
        error: err => {
          this.transferError.set(extractErrorMessage(err, this.translate.instant('offertes.transfer.error'), { allowErrorMessage: true }));
        },
      });
  }

  protected openTransferDialog(): void {
    if (!this.isAdmin()) return;

    this.showTransferDialog.set(true);
    this.transferDestinationsLoading.set(true);
    this.transferError.set(null);
    this.transferDestinationUID.set(null);

    this.transferService.listDestinationAccounts()
      .pipe(finalize(() => this.transferDestinationsLoading.set(false)))
      .subscribe({
        next: destinations => {
          this.transferDestinations.set(destinations);
          this.transferDestinationUID.set(destinations[0]?.uid ?? null);
          if (destinations.length === 0) {
            this.transferError.set(this.translate.instant('offertes.transfer.noDestinations'));
          }
        },
        error: err => this.handleOperationError(err, 'offertes.transfer.loadError'),
      });
  }

  // --- External Providers ---

  private loadMoneybirdConnectionStatus(): void {
    this.quotesService.getProviderIntegrationStatus(MONEYBIRD_PROVIDER).subscribe({
      next: status => this.moneybirdConnected.set(status.isConnected),
      error: err => this.handleOperationError(err, 'offertes.errors.moneybirdStatusLoad'),
    });
  }

  private loadMoneybirdExportStatus(quoteID: string): void {
    this.quotesService.getQuoteExportStatus(quoteID, MONEYBIRD_PROVIDER).subscribe({
      next: status => {
        this.moneybirdExported.set(status.isExported);
        this.moneybirdExternalUrl.set(status.externalUrl ?? null);
      },
      error: () => {
        this.moneybirdExported.set(false);
        this.moneybirdExternalUrl.set(null);
      },
    });
  }

  protected sendToMoneybird(): void {
    const q = this.quote();
    if (q?.status !== 'Accepted' || !this.moneybirdConnected()) return;

    this.exportingToMoneybird.set(true);
    this.quotesService.exportQuoteToProvider(q.id, MONEYBIRD_PROVIDER)
      .pipe(finalize(() => this.exportingToMoneybird.set(false)))
      .subscribe({
        next: result => {
          this.moneybirdExported.set(true);
          const externalUrl = result.externalUrl ?? null;
          this.moneybirdExternalUrl.set(externalUrl);

          const linkLabel = this.translate.instant('offertes.viewInMoneybird');
          if (externalUrl) {
            this.toast.show({
              message: this.translate.instant('offertes.bulkExportAllSuccess', { succeeded: 1 }),
              variant: 'success',
              link: { label: linkLabel, url: externalUrl, external: true },
            });
          } else {
            this.toast.success(linkLabel);
          }
        },
        error: err => this.handleOperationError(err, 'offertes.errors.moneybirdExport'),
      });
  }

  // --- Routing & Navigation Actions ---

  protected handleMobileMenuSelection(item: MenuItem): void {
    switch (item.label) {
      case 'offertes.markSent': this.updateStatus('Sent'); break;
      case 'offertes.transfer.action': this.openTransferDialog(); break;
      case 'offertes.extend': this.openExtendDialog(); break;
      case 'offertes.duplicate': this.duplicateQuote(); break;
      case 'offertes.newVersion': this.createNewVersion(); break;
      case 'offertes.preview': this.openPreview(); break;
      case 'offertes.downloadPdf': this.downloadPdf(); break;
      case 'offertes.partnerOffer.title': this.openPartnerOffer(); break;
      case 'common.delete': this.confirmDelete(); break;
    }
  }

  protected handleDesktopAction(action: string): void {
    switch (action) {
      case 'edit': this.editQuote(); break;
      case 'markSent': this.updateStatus('Sent'); break;
      case 'transfer': this.openTransferDialog(); break;
      case 'extend': this.openExtendDialog(); break;
      case 'duplicate': this.duplicateQuote(); break;
      case 'newVersion': this.createNewVersion(); break;
      case 'preview': this.openPreview(); break;
      case 'downloadPdf': this.downloadPdf(); break;
      case 'partnerOffer': this.openPartnerOffer(); break;
      case 'sendToMoneybird': this.sendToMoneybird(); break;
      case 'viewInMoneybird': this.openMoneybird(); break;
      case 'delete': this.confirmDelete(); break;
    }
  }

  protected editQuote(): void {
    const q = this.quote();
    if (q) void this.router.navigate(['/app/offertes', q.id, 'edit']);
  }

  protected openLineageSource(): void {
    const lineage = this.lineageSummary();
    if (lineage) void this.router.navigate(['/app/offertes', lineage.sourceQuoteId]);
  }

  protected openVersion(versionId: string): void {
    const current = this.quote();
    if (versionId && current?.id !== versionId) {
      void this.router.navigate(['/app/offertes', versionId]);
    }
  }

  protected openPartnerOffer(): void {
    const q = this.quote();
    if (!q) return;

    if (!q.leadServiceId) {
      this.toast.error(this.translate.instant('offertes.partnerOffer.noService'));
      return;
    }
    void this.router.navigate(['/app/offertes', q.id, 'partner-offer']);
  }

  protected openPreview(): void {
    const url = this.previewUrl();
    if (url) globalThis.open(url, '_blank', 'noopener');
  }

  protected openMoneybird(): void {
    const url = this.moneybirdExternalUrl();
    if (url) globalThis.open(url, '_blank', 'noopener');
  }

  protected deleteQuote(): void {
    const q = this.quote();
    if (q) {
      this.quotesService.delete(q.id).subscribe({
        next: () => void this.router.navigate(['/app/offertes']),
      });
    }
  }

  protected downloadPdf(): void {
    const q = this.quote();
    if (!q?.pdfFileKey) return;

    this.downloadingPdf.set(true);
    this.quotesService.downloadPdf(q.id)
      .pipe(finalize(() => this.downloadingPdf.set(false)))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Offerte-${q.quoteNumber}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
  }

  // --- Formatting Helpers ---

  protected confirmDelete(): void { this.showDeleteConfirm.set(true); }
  protected cancelDelete(): void { this.showDeleteConfirm.set(false); }
  protected openExtendDialog(): void { this.showExtendDialog.set(true); }
  protected closeExtendDialog(): void { this.showExtendDialog.set(false); }
  protected closeTransferDialog(): void { if (!this.transferringQuote()) this.showTransferDialog.set(false); }

  private buildPreviewUrl(token: string): string {
    const origin = globalThis.location?.origin ?? '';
    return origin ? `${origin}/quote/${token}` : `/quote/${token}`;
  }

  protected getStatusLabel(status: QuoteStatus): string {
    const key = `offertes.status.${status.toLowerCase()}`;
    return this.translate.instant(key) || QUOTE_STATUS_LABELS[status];
  }

  protected getStatusColor(status: QuoteStatus): string { return QUOTE_STATUS_COLORS[status]; }
  protected formatCentsCurrency(cents: number): string { return this.formatCurrency(centsToEuros(cents)); }
  protected formatQuantitySummary(quantity: string, unitPriceCents: number): string { return formatQuantityAndPrice(quantity, unitPriceCents); }
  
  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  protected formatDate(date: string): string {
    return formatDateValue(date, 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected formatAnnotationDate(date: string): string {
    return formatDateValue(date, 'nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected getVersionDiffLabel(changeType: QuoteVersionDiffItemResponse['changeType']): string { return this.translate.instant(`offertes.versionHistory.changeTypes.${changeType}`); }
  protected getVersionDiffHeadline(item: QuoteVersionDiffItemResponse): string { return item.current?.title || item.previous?.title || item.current?.description || item.previous?.description || 'Item'; }
  protected getVersionDiffDescription(item: QuoteVersionDiffItemResponse): string | null { return item.current?.description || item.previous?.description || null; }
  protected getVersionDiffBefore(item: QuoteVersionDiffItemResponse): QuoteVersionItemResponse | null { return item.previous ?? null; }
  protected getVersionDiffAfter(item: QuoteVersionDiffItemResponse): QuoteVersionItemResponse | null { return item.current ?? null; }
}