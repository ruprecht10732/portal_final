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
  QuoteActivityResponse,
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
  protected readonly versionHistory = signal<QuoteVersionHistoryResponse | null>(null);
  protected readonly loadingVersionHistory = signal(false);
  protected readonly updating = signal(false);
  protected readonly sending = signal(false);
  protected readonly duplicating = signal(false);
  protected readonly creatingVersion = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly showTransferDialog = signal(false);
  protected readonly transferDestinations = signal<TransferDestinationAccount[]>([]);
  protected readonly transferDestinationsLoading = signal(false);
  protected readonly transferDestinationUID = signal<string | null>(null);
  protected readonly transferError = signal<string | null>(null);
  protected readonly transferringQuote = signal(false);
  protected readonly transferDestinationOptions = computed<SelectOption<string>[]>(() =>
    this.transferDestinations().map(destination => ({
      value: destination.uid,
      label: destination.organizationName,
    })),
  );
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly loadingPreview = signal(false);
  protected readonly moneybirdConnected = signal(false);
  protected readonly exportingToMoneybird = signal(false);
  protected readonly moneybirdExported = signal(false);
  protected readonly moneybirdExternalUrl = signal<string | null>(null);
  protected readonly canCreateVersion = computed(() => {
    const status = this.quote()?.status;
    return status === 'Draft' || status === 'Sent';
  });
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

  // Lead service linking (for Accepted quotes with missing leadServiceId)
  protected readonly selectedLeadServiceId = signal<string | null>(null);
  protected readonly savingLeadService = signal(false);
  protected readonly isAdmin = computed(() => this.currentUser()?.roles?.includes('admin') ?? false);
  protected readonly leadServiceOptions = computed<LeadServiceOption[]>(() => {
    const services = this.lead()?.services ?? [];
    return services.map(s => ({ label: s.serviceType, value: s.id }));
  });
  protected readonly pricingIntelligenceServiceType = computed(() => {
    const lead = this.lead();
    const leadServiceId = this.selectedLeadServiceId();
    if (!lead || !leadServiceId) {
      return null;
    }

    return lead.services.find(service => service.id === leadServiceId)?.serviceType ?? null;
  });
  protected readonly pricingIntelligencePostcodePrefix = computed(() =>
    derivePostcodePrefixZip4(this.lead()?.address.zipCode ?? this.quote()?.customerAddressZipCode),
  );

  // Reply text per item (keyed by item ID)
  protected readonly replyTexts = signal<Record<string, string>>({});
  protected readonly replyingItemId = signal<string | null>(null);
  protected readonly draftingReplyItemId = signal<string | null>(null);

  // SSE activity feed — starts with persisted history, live events prepend
  protected readonly realtimeEvents = signal<{ type: string; message: string; time: Date }[]>([]);

  protected readonly mobileMenuSections = computed<readonly MenuSection[]>(() => {
    const q = this.quote();
    const previewAvailable = !!this.previewUrl();
    const pdfAvailable = !!q?.pdfFileKey;
    const canOpenPartnerOffer = q?.status === 'Accepted' && !!q?.leadServiceId;
    const canCreateVersion = q?.status === 'Draft' || q?.status === 'Sent';
    return [
      {
        items: [
          { label: 'offertes.transfer.action', disabled: !this.isAdmin() },
          { label: 'offertes.duplicate' },
          { label: 'offertes.newVersion', disabled: !canCreateVersion },
          { label: 'offertes.preview', disabled: !previewAvailable },
          { label: 'offertes.downloadPdf', disabled: !pdfAvailable },
          { label: 'offertes.partnerOffer.title', disabled: !canOpenPartnerOffer },
          { label: 'common.delete' },
        ],
      },
    ];
  });

  protected readonly desktopActionMenuSections = computed<readonly SplitMenuSection[]>(() => {
    const q = this.quote();
    if (!q) return [];
    const previewAvailable = !!this.previewUrl();
    const pdfAvailable = !!q.pdfFileKey;
    const canOpenPartnerOffer = q.status === 'Accepted' && !!q.leadServiceId;
    const canCreateVersion = q.status === 'Draft' || q.status === 'Sent';
    const items: SplitMenuItem[] = [];

    if (q.status === 'Draft') {
      items.push({
        label: 'offertes.edit',
        action: 'edit',
        icon: 'pencil',
      });
    }

    if (this.isAdmin()) {
      items.push({
        label: 'offertes.transfer.action',
        action: 'transfer',
        icon: 'send',
      });
    }

    items.push({
      label: 'offertes.duplicate',
      action: 'duplicate',
      icon: 'copy',
      disabled: this.duplicating(),
    });

    if (canCreateVersion) {
      items.push({
        label: 'offertes.newVersion',
        action: 'newVersion',
        icon: 'git-branch',
        disabled: this.creatingVersion(),
      });
    }

    if (canOpenPartnerOffer) {
      items.push({
        label: 'offertes.partnerOffer.title',
        action: 'partnerOffer',
        icon: 'handshake',
        disabled: !q.leadServiceId,
      });
    }

    if (previewAvailable) {
      items.push({
        label: 'offertes.preview',
        action: 'preview',
        icon: 'eye',
      });
    }

    if (pdfAvailable) {
      items.push({
        label: 'offertes.downloadPdf',
        action: 'downloadPdf',
        icon: 'download',
        disabled: this.downloadingPdf(),
      });
    }

    if (q.status === 'Accepted' && this.moneybirdConnected()) {
      if (!this.moneybirdExported()) {
        items.push({
          label: 'offertes.sendToMoneybird',
          action: 'sendToMoneybird',
          icon: 'send',
          disabled: this.exportingToMoneybird(),
        });
      } else {
        items.push({
          label: 'offertes.viewInMoneybird',
          action: 'viewInMoneybird',
          icon: 'external-link',
        });
      }
    }

    items.push({
      label: 'common.delete',
      action: 'delete',
      icon: 'trash-2',
      tone: 'danger',
    });

    return [{ items }];
  });

  ngOnInit(): void {
    this.showPostSaveFeedbackToast();
    this.loadMoneybirdConnectionStatus();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadQuote(id);
      this.loadActivityHistory(id);
      this.listenForSSEEvents(id);
    } else {
      this.router.navigate(['/app/offertes']);
    }
  }

  private showPostSaveFeedbackToast(): void {
    const state = (this.router.currentNavigation()?.extras.state ?? globalThis.history.state ?? null) as {
      aiFeedbackCount?: number;
    } | null;

    const feedbackCount = typeof state?.aiFeedbackCount === 'number' ? state.aiFeedbackCount : 0;
    if (feedbackCount < 1) {
      return;
    }

    const translationKey = feedbackCount === 1
      ? 'offertes.aiFeedbackCapturedSingle'
      : 'offertes.aiFeedbackCapturedMultiple';
    this.toast.success(this.translate.instant(translationKey, { count: feedbackCount }));

    const currentHistoryState = globalThis.history.state as Record<string, unknown> | null;
    const nextState = currentHistoryState ? { ...currentHistoryState } : {};
    delete nextState['aiFeedbackCount'];
    globalThis.history.replaceState(nextState, document.title, this.router.url);
  }

  private loadActivityHistory(quoteId: string): void {
    this.quotesService.getActivities(quoteId).subscribe({
      next: (activities: QuoteActivityResponse[]) => {
        const mapped = activities.map(a => ({
          type: a.eventType,
          message: a.message,
          time: new Date(a.createdAt),
        }));
        this.realtimeEvents.set(mapped);
      },
      error: () => {
        // silently ignore — history is non-critical
      },
    });
  }

  private listenForSSEEvents(quoteId: string): void {
    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const data = event.data;
        const evtQuoteId = (data?.['quoteId'] as string) ?? '';
        if (evtQuoteId !== quoteId) return;

        const payload = data?.['payload'] as Record<string, unknown> | undefined;

        let message = '';
        switch (event.type) {
          case 'quote_sent':
            message = 'Offerte verstuurd naar de klant';
            break;
          case 'quote_viewed':
            message = 'Klant heeft de offerte geopend';
            break;
          case 'quote_item_toggled': {
            const desc = (payload?.['itemDescription'] as string) || 'een item';
            message = `Klant heeft '${desc}' ${payload?.['isSelected'] ? 'ingeschakeld' : 'uitgeschakeld'}`;
            this.loadQuote(quoteId); // refresh totals
            break;
          }
          case 'quote_annotated':
            message = `Nieuwe vraag: "${(payload?.['text'] as string)?.substring(0, 50) ?? ''}"`;
            this.loadQuote(quoteId); // refresh to show new annotations
            break;
          case 'quote_accepted':
            message = `Offerte geaccepteerd door ${typeof payload?.['signatureName'] === 'string' ? payload['signatureName'] : 'klant'}`;
            this.loadQuote(quoteId);
            break;
          case 'quote_rejected':
            message = 'Offerte afgewezen door klant';
            this.loadQuote(quoteId);
            break;
          default:
            return;
        }

        this.realtimeEvents.update(events => [
          { type: event.type, message, time: new Date() },
          ...events.slice(0, 19), // keep last 20
        ]);
      });
  }

  private loadQuote(id: string): void {
    this.loading.set(true);
    this.quotesService.getById(id).subscribe({
      next: quote => {
        if (quote) {
          this.quote.set(quote);
          this.loadVersionHistory(quote.id);
          this.selectedLeadServiceId.set(quote.leadServiceId ?? null);
          this.loadPreviewLink(quote);
          this.loadLead(quote.leadId);
          this.loadMoneybirdExportStatus(quote.id);
        } else {
          this.error.set(this.translate.instant('offertes.errors.notFound'));
          this.loading.set(false);
        }
      },
      error: () => {
        this.versionHistory.set(null);
        this.error.set(this.translate.instant('offertes.errors.loadQuote'));
        this.loading.set(false);
      },
    });
  }

  private loadVersionHistory(id: string): void {
    this.loadingVersionHistory.set(true);
    this.quotesService.getVersionHistory(id).subscribe({
      next: history => {
        this.versionHistory.set(history);
        this.loadingVersionHistory.set(false);
      },
      error: () => {
        this.versionHistory.set(null);
        this.loadingVersionHistory.set(false);
      },
    });
  }

  private loadLead(id: string): void {
    this.leadsService.getById(id).subscribe({
      next: lead => {
        this.lead.set(lead);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/offertes']);
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
    this.quotesService.suggestAnnotationReplyDraft(q.id, itemId).subscribe({
      next: draft => {
        this.replyTexts.update(prev => ({ ...prev, [itemId]: draft.text }));
        this.draftingReplyItemId.set(null);
      },
      error: err => {
        this.draftingReplyItemId.set(null);
        const message = extractErrorMessage(err, this.translate.instant('offertes.errors.replyDraft'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected submitReply(itemId: string): void {
    const q = this.quote();
    if (!q) return;
    const text = (this.replyTexts()[itemId] ?? '').trim();
    if (!text) return;

    this.replyingItemId.set(itemId);
    this.quotesService.annotateItem(q.id, itemId, text).subscribe({
      next: () => {
        this.replyTexts.update(prev => ({ ...prev, [itemId]: '' }));
        this.replyingItemId.set(null);
        // Reload quote to refresh annotations
        this.loadQuote(q.id);
      },
      error: () => {
        this.replyingItemId.set(null);
      },
    });
  }

  protected handleMobileMenuSelection(item: MenuItem): void {
    switch (item.label) {
      case 'offertes.transfer.action':
        this.openTransferDialog();
        break;
      case 'offertes.duplicate':
        this.duplicateQuote();
        break;
      case 'offertes.newVersion':
        this.createNewVersion();
        break;
      case 'offertes.preview':
        this.openPreview();
        break;
      case 'offertes.downloadPdf':
        this.downloadPdf();
        break;
      case 'offertes.partnerOffer.title':
        this.openPartnerOffer();
        break;
      case 'common.delete':
        this.confirmDelete();
        break;
      default:
        break;
    }
  }

  protected handleDesktopAction(action: string): void {
    switch (action) {
      case 'edit':
        this.editQuote();
        break;
      case 'transfer':
        this.openTransferDialog();
        break;
      case 'duplicate':
        this.duplicateQuote();
        break;
      case 'newVersion':
        this.createNewVersion();
        break;
      case 'preview':
        this.openPreview();
        break;
      case 'downloadPdf':
        this.downloadPdf();
        break;
      case 'partnerOffer':
        this.openPartnerOffer();
        break;
      case 'sendToMoneybird':
        this.sendToMoneybird();
        break;
      case 'viewInMoneybird':
        this.openMoneybird();
        break;
      case 'delete':
        this.confirmDelete();
        break;
      default:
        break;
    }
  }

  protected openPartnerOffer(): void {
    const q = this.quote();
    if (!q) return;

    if (!q.leadServiceId) {
      this.toast.error(this.translate.instant('offertes.partnerOffer.noService'));
      return;
    }

    this.router.navigate(['/app/offertes', q.id, 'partner-offer']);
  }

  protected saveLeadServiceLink(): void {
    const q = this.quote();
    const leadServiceId = this.selectedLeadServiceId();
    if (!q || !leadServiceId) return;
    if (q.leadServiceId === leadServiceId) return;

    this.savingLeadService.set(true);
    this.quotesService.setLeadServiceId(q.id, leadServiceId).subscribe({
      next: updated => {
        this.quote.set(updated);
        this.selectedLeadServiceId.set(updated.leadServiceId ?? null);
        this.savingLeadService.set(false);
        this.toast.success(this.translate.instant('common.saved'));
      },
      error: err => {
        this.savingLeadService.set(false);
        const message = extractErrorMessage(err, this.translate.instant('common.error'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected editQuote(): void {
    const q = this.quote();
    if (q) {
      this.router.navigate(['/app/offertes', q.id, 'edit']);
    }
  }

  protected openLineageSource(): void {
    const lineage = this.lineageSummary();
    if (!lineage) return;
    this.router.navigate(['/app/offertes', lineage.sourceQuoteId]);
  }

  protected openVersion(versionId: string): void {
    const current = this.quote();
    if (!versionId || current?.id === versionId) {
      return;
    }
    this.router.navigate(['/app/offertes', versionId]);
  }

  protected duplicateQuote(): void {
    const q = this.quote();
    if (!q || this.duplicating()) return;

    this.duplicating.set(true);
    this.quotesService.duplicate(q.id).subscribe({
      next: duplicated => {
        this.duplicating.set(false);
        this.toast.success(this.translate.instant('offertes.duplicateSuccess', { quoteNumber: duplicated.quoteNumber }));
        this.router.navigate(['/app/offertes', duplicated.id, 'edit']);
      },
      error: err => {
        this.duplicating.set(false);
        this.handleCloneError(err, 'offertes.errors.duplicate');
      },
    });
  }

  protected createNewVersion(): void {
    const q = this.quote();
    if (!q || !this.canCreateVersion() || this.creatingVersion()) return;

    this.creatingVersion.set(true);
    this.quotesService.createVersion(q.id).subscribe({
      next: created => {
        this.creatingVersion.set(false);
        this.toast.success(this.translate.instant('offertes.newVersionSuccess', { quoteNumber: created.quoteNumber }));
        this.router.navigate(['/app/offertes', created.id, 'edit']);
      },
      error: err => {
        this.creatingVersion.set(false);
        this.handleCloneError(err, 'offertes.errors.newVersion');
      },
    });
  }

  protected updateStatus(status: QuoteStatus): void {
    const q = this.quote();
    if (!q) return;

    this.updating.set(true);
    this.quotesService.updateStatus(q.id, status).subscribe({
      next: updated => {
        if (updated) {
          this.quote.set(updated);
          this.loadPreviewLink(updated);
        }
        this.updating.set(false);
      },
      error: () => {
        this.updating.set(false);
      },
    });
  }

  protected confirmDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  protected deleteQuote(): void {
    const q = this.quote();
    if (!q) return;

    this.quotesService.delete(q.id).subscribe({
      next: () => {
        this.router.navigate(['/app/offertes']);
      },
    });
  }

  protected downloadPdf(): void {
    const q = this.quote();
    if (!q?.pdfFileKey) return;

    this.downloadingPdf.set(true);
    this.quotesService.downloadPdf(q.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Offerte-${q.quoteNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.downloadingPdf.set(false);
      },
    });
  }

  protected sendProposal(): void {
    const q = this.quote();
    if (!q) return;

    this.sending.set(true);
    this.quotesService.send(q.id).subscribe({
      next: updated => {
        if (updated) {
          this.quote.set(updated);
          this.loadPreviewLink(updated);
        }
        this.sending.set(false);
      },
      error: () => {
        this.sending.set(false);
      },
    });
  }

  protected openTransferDialog(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.showTransferDialog.set(true);
    this.transferDestinationsLoading.set(true);
    this.transferError.set(null);
    this.transferDestinationUID.set(null);

    this.transferService.listDestinationAccounts().subscribe({
      next: destinations => {
        this.transferDestinations.set(destinations);
        this.transferDestinationUID.set(destinations[0]?.uid ?? null);
        this.transferDestinationsLoading.set(false);
        if (destinations.length === 0) {
          this.transferError.set(this.translate.instant('offertes.transfer.noDestinations'));
        }
      },
      error: err => {
        this.transferDestinationsLoading.set(false);
        const message = extractErrorMessage(err, this.translate.instant('offertes.transfer.loadError'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.transferError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected closeTransferDialog(): void {
    if (this.transferringQuote()) {
      return;
    }

    this.showTransferDialog.set(false);
    this.transferError.set(null);
    this.transferDestinationUID.set(null);
  }

  protected confirmTransferQuote(): void {
    const quote = this.quote();
    const destinationUID = this.transferDestinationUID();
    if (!quote || !destinationUID || this.transferringQuote()) {
      return;
    }

    this.transferringQuote.set(true);
    this.transferError.set(null);

    this.transferService.transferQuote(quote, this.lead(), destinationUID).subscribe({
      next: result => {
        this.transferringQuote.set(false);
        this.showTransferDialog.set(false);
        const successKey = result.sourceLeadDeleted
          ? 'offertes.transfer.successLeadDeleted'
          : 'offertes.transfer.successServiceOnly';
        this.toast.success(this.translate.instant(successKey, {
          organization: result.destination.organizationName,
        }));
        void this.router.navigate(['/app/offertes']);
      },
      error: err => {
        this.transferringQuote.set(false);
        const message = extractErrorMessage(err, this.translate.instant('offertes.transfer.error'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.transferError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadPreviewLink(q: QuoteResponse): void {
    this.loadingPreview.set(true);
    this.quotesService.getPreviewLink(q.id).subscribe({
      next: response => {
        this.previewUrl.set(this.buildPreviewUrl(response.token));
        this.loadingPreview.set(false);
      },
      error: () => {
        this.previewUrl.set(null);
        this.loadingPreview.set(false);
      },
    });
  }

  protected openPreview(): void {
    const url = this.previewUrl();
    if (!url) return;
    globalThis.open(url, '_blank', 'noopener');
  }

  private loadMoneybirdConnectionStatus(): void {
    this.quotesService.getProviderIntegrationStatus(MONEYBIRD_PROVIDER).subscribe({
      next: status => {
        this.moneybirdConnected.set(status.isConnected);
      },
      error: err => {
        this.moneybirdConnected.set(false);
        const message = this.translate.instant('offertes.errors.moneybirdStatusLoad');
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
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
            link: {
              label: linkLabel,
              url: externalUrl,
              external: true,
            },
          });
          return;
        }

        this.toast.success(linkLabel);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('offertes.errors.moneybirdExport'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected openMoneybird(): void {
    const url = this.moneybirdExternalUrl();
    if (!url) return;
    globalThis.open(url, '_blank', 'noopener');
  }

  private handleCloneError(err: unknown, fallbackKey: string): void {
    const message = extractErrorMessage(err, this.translate.instant(fallbackKey), {
      allowErrorMessage: true,
      allowMessageField: true,
    });
    this.toast.error(message);
    this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
  }

  private buildPreviewUrl(token: string): string {
    const origin = globalThis.location?.origin ?? '';
    return origin ? `${origin}/quote/${token}` : `/quote/${token}`;
  }

  protected getStatusLabel(status: QuoteStatus): string {
    const key = `offertes.status.${status.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated || QUOTE_STATUS_LABELS[status];
  }

  protected getStatusColor(status: QuoteStatus): string {
    return QUOTE_STATUS_COLORS[status];
  }

  protected formatCentsCurrency(cents: number): string {
    return this.formatCurrency(centsToEuros(cents));
  }

  protected formatQuantitySummary(quantity: string, unitPriceCents: number): string {
    return formatQuantityAndPrice(quantity, unitPriceCents);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  protected formatDate(date: string): string {
    return formatDateValue(date, 'nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected formatAnnotationDate(date: string): string {
    return formatDateValue(date, 'nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getVersionDiffLabel(changeType: QuoteVersionDiffItemResponse['changeType']): string {
    return this.translate.instant(`offertes.versionHistory.changeTypes.${changeType}`);
  }

  protected getVersionDiffHeadline(item: QuoteVersionDiffItemResponse): string {
    return item.current?.title || item.previous?.title || item.current?.description || item.previous?.description || 'Item';
  }

  protected getVersionDiffDescription(item: QuoteVersionDiffItemResponse): string | null {
    return item.current?.description || item.previous?.description || null;
  }

  protected getVersionDiffBefore(item: QuoteVersionDiffItemResponse): QuoteVersionItemResponse | null {
    return item.previous ?? null;
  }

  protected getVersionDiffAfter(item: QuoteVersionDiffItemResponse): QuoteVersionItemResponse | null {
    return item.current ?? null;
  }
}
