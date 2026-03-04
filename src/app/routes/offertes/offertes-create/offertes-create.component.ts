import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LeadsService } from '../../../core/services/leads.service';
import { QuotesService } from '../../../core/services/quotes.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { CatalogService, type AutocompleteItemResponse, type MaterialPricingMode, type Product } from '../../../core/services/catalog.service';
import { AIJobService } from '../../../core/services/ai-job.service';
import type { Lead } from '../../../core/services/leads.types';
import type {
  QuoteResponse,
  TaxRateDisplay,
  DiscountType,
  PricingMode,
  QuoteItemRequest,
  QuoteCalculationResponse,
  QuoteAttachmentRequest,
  QuoteURLRequest,
  GenerateQuoteRequest,
} from '../../../core/services/quotes.types';
import { TAX_RATE_OPTIONS, DISCOUNT_TYPE_OPTIONS, parseQuantityNumber, eurosToCents, centsToEuros, taxDisplayToBps, taxBpsToDisplay } from '../../../core/services/quotes.types';

import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { SplitActionComponent, type SplitMenuSection } from '../../../shared/components/split-action/split-action.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { type GhostSuggestion } from '../../../shared/components/ghost-text/ghost-text.directive';
import { AttachmentPanelComponent, type AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import { FilePreviewDialogComponent } from '../../../shared/components/file-preview-dialog/file-preview-dialog.component';
import { QuoteLineItemRowComponent } from './quote-line-item-row.component';

interface LineItemDraft {
  id: string;
  title: string;
  description: string;
  quantity: string; // Free-form: "5 x", "10 m²", "3 uur"
  unitPrice: number;
  taxRate: TaxRateDisplay;
  optional: boolean;
  catalogProductId?: string;
  parentLineItemId?: string;
}

@Component({
  selector: 'app-offertes-create',
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    TranslatePipe,
    LucideAngularModule,
    AutocompleteComponent,
    ButtonComponent,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    RichTextEditorComponent,
    SelectComponent,
    SplitActionComponent,
    TextareaComponent,
    PageHeaderComponent,
    AttachmentPanelComponent,
    FilePreviewDialogComponent,
    QuoteLineItemRowComponent,
  ],
  templateUrl: './offertes-create.component.html',
  styleUrl: './offertes-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly quotesService = inject(QuotesService);
  private readonly orgService = inject(OrganizationService);
  private readonly catalogService = inject(CatalogService);
  private readonly aiJobs = inject(AIJobService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly materialExpandRequestSeq = new Map<string, number>();

  // Server-side calculation trigger
  private readonly calcTrigger$ = new Subject<void>();

  // State
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly existingQuote = signal<QuoteResponse | null>(null);

  // AI Generate state
  protected readonly generatePrompt = signal('');
  protected readonly generating = signal(false);
  protected readonly generateError = signal<string | null>(null);
  protected readonly showGeneratePanel = signal(true);
  protected readonly currentGenerateJobId = signal<string | null>(null);
  protected readonly currentGenerateJob = computed(() => this.aiJobs.job(this.currentGenerateJobId()));
  protected readonly isGenerateLocked = computed(() => {
    const status = this.currentGenerateJob()?.status;
    return status === 'pending' || status === 'running';
  });
  protected readonly financingDisclaimer = signal(false);

  // Lead's services
  // Single source of truth:
  // - Used as quote.leadServiceId (linkage)
  // - Used as leadServiceId for AI generation
  protected readonly selectedLeadServiceId = signal<string | null>(null);
  protected readonly leadServices = computed(() => this.selectedLead()?.services ?? []);
  protected readonly leadServiceOptions = computed<SelectOption<string>[]>(() =>
    this.leadServices().map(s => ({ label: s.serviceType, value: s.id }))
  );
  protected readonly selectedLeadServiceLabel = computed(() => {
    const id = this.selectedLeadServiceId();
    if (!id) return null;
    return this.leadServices().find(s => s.id === id)?.serviceType ?? null;
  });

  // Lead selection
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadOptions = signal<AutocompleteOption[]>([]);
  private readonly leadSuggestions = signal<Lead[]>([]);

  private static readonly CREATE_LEAD_OPTION_VALUE = '__create_new_lead__';

  // Line items
  protected readonly lineItems = signal<LineItemDraft[]>([]);
  protected readonly descriptionEditState = signal<Record<string, boolean>>({});

  // Document attachments & URLs (collected from catalog autocomplete + manual uploads)
  protected readonly attachmentDrafts = signal<AttachmentDraft[]>([]);
  protected readonly urlDrafts = signal<{ uid: string; label: string; href: string; catalogProductId?: string }[]>([]);

  // File preview dialog state
  protected readonly previewOpen = signal(false);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly previewAttachment = signal<AttachmentDraft | null>(null);
  protected readonly previewTitle = computed(() => this.previewAttachment()?.filename ?? 'File preview');
  protected readonly previewFileName = computed(() => this.previewAttachment()?.filename ?? '');
  protected readonly previewContentType = computed(() => {
    const name = this.previewAttachment()?.filename ?? '';
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext ?? '')) return `image/${ext}`;
    return null;
  });

  // Remember last VAT choice for new lines
  protected readonly lastUsedTaxRate = signal<TaxRateDisplay>(21);
  protected readonly pricingMode = signal<PricingMode>('exclusive');

  // Server-side calculation result
  protected readonly serverCalc = signal<QuoteCalculationResponse | null>(null);
  protected readonly calculating = signal(false);

  // Summary form
  protected readonly summaryForm = this.fb.group({
    discountType: this.fb.control<DiscountType>('percentage', { nonNullable: true }),
    discountValue: [0],
    validUntil: [''],
    notes: [''],
  });

  protected readonly discountType = signal<DiscountType>('percentage');
  protected readonly discountValue = signal(0);
  protected readonly discountPrefix = computed(() => (this.discountType() === 'fixed' ? '€' : ''));
  protected readonly discountSuffix = computed(() => (this.discountType() === 'percentage' ? '%' : ''));
  protected readonly pricingModeOptions = computed<SelectOption<PricingMode>[]>(() => [
    { label: this.translate.instant('offertes.pricesExclVat'), value: 'exclusive' },
    { label: this.translate.instant('offertes.pricesInclVat'), value: 'inclusive' },
  ]);

  // Options for selects
  protected readonly taxRateOptions = computed<SelectOption<TaxRateDisplay>[]>(() =>
    TAX_RATE_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))
  );

  protected readonly discountTypeOptions = computed<SelectOption<DiscountType>[]>(() =>
    DISCOUNT_TYPE_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))
  );

  // Calculated totals — derived from server calculation when available, else client-side fallback
  protected readonly totals = computed(() => {
    const calc = this.serverCalc();
    if (calc) {
      return {
        subtotal: centsToEuros(calc.subtotalCents),
        discountAmount: centsToEuros(calc.discountAmountCents),
        taxAmount: centsToEuros(calc.vatTotalCents),
        total: centsToEuros(calc.totalCents),
      };
    }
    // Client-side fallback (shown while server request is in-flight)
    const items = this.lineItems().filter(i => !i.optional);
    const mode = this.pricingMode();
    const dType = this.discountType();
    const dValue = this.discountValue();
    const subtotal = items.reduce((sum, item) => sum + parseQuantityNumber(item.quantity) * item.unitPrice, 0);

    let discountAmount = dType === 'percentage' ? subtotal * (dValue / 100) : dValue;
    discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);

    const taxAmount = items.reduce((sum, item) => {
      const lineTotal = parseQuantityNumber(item.quantity) * item.unitPrice;
      const rate = item.taxRate / 100;
      return sum + (mode === 'exclusive' ? lineTotal * rate : lineTotal - lineTotal / (1 + rate));
    }, 0);

    const total = mode === 'exclusive' ? subtotal - discountAmount + taxAmount : subtotal - discountAmount;
    return { subtotal, discountAmount, taxAmount, total };
  });

  protected readonly taxBreakdown = computed(() => {
    const calc = this.serverCalc();
    if (calc?.vatBreakdown?.length) {
      return calc.vatBreakdown
        .filter(b => b.amountCents > 0)
        .map(b => ({ rate: b.rateBps / 100, amount: centsToEuros(b.amountCents) }))
        .sort((a, b) => b.rate - a.rate);
    }
    // Client-side fallback
    const items = this.lineItems().filter(i => !i.optional);
    const mode = this.pricingMode();

    const byRate = new Map<number, number>();
    for (const item of items) {
      const lineTotal = parseQuantityNumber(item.quantity) * item.unitPrice;
      const rate = item.taxRate / 100;
      const tax = mode === 'exclusive' ? lineTotal * rate : lineTotal - lineTotal / (1 + rate);
      byRate.set(item.taxRate, (byRate.get(item.taxRate) ?? 0) + tax);
    }

    return [...byRate.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([rate, amount]) => ({ rate, amount }))
      .sort((a, b) => b.rate - a.rate);
  });

  protected readonly headerActionSections = computed<SplitMenuSection[]>(() => [
    {
      items: [
        {
          label: 'offertes.saveDraft',
          action: 'saveDraft',
          disabled: !this.canSave() || this.saving(),
        },
        {
          label: 'offertes.saveAndSend',
          action: 'saveAndSend',
          disabled: !this.canSave() || this.saving(),
        },
        {
          label: 'offertes.cancel',
          action: 'cancel',
        },
      ],
    },
  ]);

  // Check if can save
  protected readonly canSave = computed(() => {
    return this.selectedLead() !== null && this.lineItems().length > 0;
  });

  ngOnInit(): void {
    // Wire up debounced server-side calculation
    this.calcTrigger$
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const validItems = this.lineItems().filter(i => i.description.trim() !== '');
          if (validItems.length === 0) {
            this.serverCalc.set(null);
            this.calculating.set(false);
            return [];
          }
          this.calculating.set(true);
          const dType = this.discountType();
          const dVal = dType === 'fixed' ? eurosToCents(this.discountValue()) : this.discountValue();
          return this.quotesService.calculate({
            items: validItems.map(i => ({
              description: i.description,
              quantity: i.quantity || '1',
              unitPriceCents: eurosToCents(i.unitPrice),
              taxRateBps: taxDisplayToBps(i.taxRate),
              isOptional: i.optional,
            })),
            pricingMode: this.pricingMode(),
            discountType: dType,
            discountValue: dVal,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: result => {
          this.serverCalc.set(result);
          this.calculating.set(false);
        },
        error: () => {
          this.calculating.set(false);
        },
      });

    // Check for leadId in query params
    const leadId = this.route.snapshot.queryParamMap.get('leadId');
    const preferredServiceId = this.route.snapshot.queryParamMap.get('serviceId') ?? undefined;
    if (leadId) {
      this.loadLead(leadId, preferredServiceId);
    }

    // Check for edit mode
    const quoteId = this.route.snapshot.paramMap.get('id');
    if (quoteId) {
      this.isEditMode.set(true);
      this.loadQuote(quoteId);
    } else {
      this.ensureInitialLineItem();
      this.loadDefaultValidity();
    }
  }

  /** Load org settings and pre-populate validUntil for new quotes. */
  private loadDefaultValidity(): void {
    this.orgService.getSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        if (!this.summaryForm.controls.validUntil.value && settings.quoteValidDays > 0) {
          const date = new Date();
          date.setDate(date.getDate() + settings.quoteValidDays);
          this.summaryForm.controls.validUntil.setValue(date.toISOString().split('T')[0] ?? '');
        }
      },
    });
  }

  protected onLeadSearchChange(value: string): void {
    this.leadSearchQuery.set(value);

    // When a suggestion is clicked, the shared autocomplete emits the option label.
    // Avoid triggering a new search when the clicked value is one of our current options.
    const selectedOption = this.leadOptions().find(o => o.label === value);
    if (selectedOption?.value === OffertesCreateComponent.CREATE_LEAD_OPTION_VALUE) {
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      this.leadSuggestions.set([]);
      this.leadOptions.set(query ? [this.buildCreateLeadOption(query)] : []);
      return;
    }

    this.leadsService.list({ search: value, pageSize: 10 }).subscribe({
      next: response => {
        this.leadSuggestions.set(response.items);
				const options = response.items.map(lead => ({
					label: `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`,
					value: lead.id,
				}));
				options.push(this.buildCreateLeadOption(query));
				this.leadOptions.set(options);
      },
      error: () => {
				this.leadSuggestions.set([]);
				this.leadOptions.set(query ? [this.buildCreateLeadOption(query)] : []);
      },
    });
  }

  protected onLeadSelected(value: string): void {
    const selectedOption = this.leadOptions().find(o => o.label === value);
    if (selectedOption?.value === OffertesCreateComponent.CREATE_LEAD_OPTION_VALUE) {
      const returnTo = this.router.url.split('?')[0] ?? '/app/offertes/new';
      this.router.navigate(['/app/leads/new'], { queryParams: { returnTo, source: 'quote_flow' } });
      return;
    }

    const leadId = selectedOption?.value;
    const lead = leadId ? this.leadSuggestions().find(l => l.id === leadId) : null;

    if (lead) {
      this.selectedLead.set(lead);
      // Default to the first service; user can change it explicitly.
      this.selectedLeadServiceId.set(lead.services?.[0]?.id ?? null);
      this.leadSearchQuery.set(
        `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`
      );
    }
  }

  private buildCreateLeadOption(query: string): AutocompleteOption {
    const label = this.translate.instant('offertes.leadAutocomplete.createNewWithQuery', { query });
    return { label, value: OffertesCreateComponent.CREATE_LEAD_OPTION_VALUE };
  }

  protected clearLead(): void {
    this.selectedLead.set(null);
    this.selectedLeadServiceId.set(null);
    this.leadSearchQuery.set('');
    this.leadOptions.set([]);
    this.leadSuggestions.set([]);
  }

  private loadLead(id: string, preferredServiceId?: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: lead => {
        this.selectedLead.set(lead);
        const nextServiceId =
          preferredServiceId && lead.services?.some(s => s.id === preferredServiceId)
            ? preferredServiceId
            : (lead.services?.[0]?.id ?? null);
        this.selectedLeadServiceId.set(nextServiceId);
        this.leadSearchQuery.set(
          `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translate.instant('offertes.errors.loadLead'));
      },
    });
  }

  private loadQuote(id: string): void {
    this.loading.set(true);
    this.quotesService.getById(id).subscribe({
      next: quote => {
        if (quote) this.applyQuote(quote);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translate.instant('offertes.errors.loadQuote'));
      },
    });
  }

  private applyQuote(quote: QuoteResponse): void {
    this.existingQuote.set(quote);
    this.lineItems.set(
      quote.items.map(item => ({
        id: item.id,
        title: item.title ?? '',
        description: item.description,
        quantity: item.quantity,
        unitPrice: centsToEuros(item.unitPriceCents),
        taxRate: taxBpsToDisplay(item.taxRateBps),
        optional: item.isOptional,
        ...(item.catalogProductId == null ? {} : { catalogProductId: item.catalogProductId }),
      }))
    );
    this.descriptionEditState.set(
      Object.fromEntries(
        quote.items.map(item => [item.id, !(item.catalogProductId && /<[^>]+>/.test(item.description))]),
      ),
    );

    // Restore attachments
    if (quote.attachments?.length) {
      this.attachmentDrafts.set(
        quote.attachments.map(a => ({
          uid: a.id,
          filename: a.filename,
          fileKey: a.fileKey,
          source: a.source,
          ...(a.catalogProductId == null ? {} : { catalogProductId: a.catalogProductId }),
          enabled: a.enabled,
          sortOrder: a.sortOrder,
        })),
      );
    }

    // Restore URLs
    if (quote.urls?.length) {
      this.urlDrafts.set(
        quote.urls.map(u => ({
          uid: u.id,
          label: u.label,
          href: u.href,
          ...(u.catalogProductId == null ? {} : { catalogProductId: u.catalogProductId }),
        })),
      );
    }
    const discountDisplayValue = quote.discountType === 'fixed' ? centsToEuros(quote.discountValue) : quote.discountValue;
    const validUntil = quote.validUntil ? (quote.validUntil.split('T')[0] ?? null) : null;
    this.summaryForm.patchValue({
      discountType: quote.discountType,
      discountValue: discountDisplayValue,
      validUntil,
      notes: quote.notes ?? '',
    });
    this.discountType.set(quote.discountType);
    this.discountValue.set(discountDisplayValue);
    this.pricingMode.set(quote.pricingMode ?? 'exclusive');
    this.financingDisclaimer.set(quote.financingDisclaimer ?? false);
    const firstItemTaxRate = quote.items.at(0)?.taxRateBps;
    this.lastUsedTaxRate.set(firstItemTaxRate != null ? taxBpsToDisplay(firstItemTaxRate) : 21);
    this.ensureInitialLineItem();
    this.requestCalculation();
    if (quote.leadId) {
      this.loadLead(quote.leadId, quote.leadServiceId);
    }
  }

  // Line item management
  protected addLineItem(): void {
    const item = this.createEmptyLineItem();
    this.lineItems.update(items => [...items, item]);
    this.descriptionEditState.update(state => ({ ...state, [item.id]: true }));
    this.requestCalculation();
  }

  protected removeLineItem(id: string): void {
    const removedGeneratedIds = this.lineItems()
      .filter(item => item.parentLineItemId === id)
      .map(item => item.id);

    this.lineItems.update(items => {
      if (items.length <= 1) {
        const item = this.createEmptyLineItem();
        this.descriptionEditState.set({ [item.id]: true });
        return [item];
      }
      return items.filter(item => item.id !== id && item.parentLineItemId !== id);
    });
    this.descriptionEditState.update(state => {
      const next = { ...state };
      delete next[id];
      for (const generatedId of removedGeneratedIds) delete next[generatedId];
      return next;
    });
    this.requestCalculation();
  }

  protected onLineItemDrop(event: CdkDragDrop<LineItemDraft[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.lineItems.update(items => {
      const reordered = [...items];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      return reordered;
    });
    this.requestCalculation();
  }

  protected isDescriptionEditing(item: LineItemDraft): boolean {
    const current = this.descriptionEditState()[item.id];
    if (current !== undefined) return current;
    return !(item.catalogProductId && /<[^>]+>/.test(item.description));
  }

  protected setDescriptionEditing(item: LineItemDraft, editing: boolean): void {
    this.descriptionEditState.update(state => ({ ...state, [item.id]: editing }));
  }

  protected updateLineItem(
    id: string,
    field: 'title' | 'description' | 'quantity' | 'unitPrice' | 'taxRate' | 'optional',
    value: string | number | boolean
  ): void {
    this.lineItems.update(items =>
      items.map(item => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      })
    );
    this.requestCalculation();
  }

  protected updateLineItemPrice(id: string, price: number | null): void {
    this.updateLineItem(id, 'unitPrice', price ?? 0);
  }

  protected updateLineItemTaxRate(id: string, rate: TaxRateDisplay | null): void {
    if (rate === null) return;
    this.lastUsedTaxRate.set(rate);
    this.updateLineItem(id, 'taxRate', rate);
  }

  protected updateLineItemOptional(id: string, optional: boolean | null): void {
    this.updateLineItem(id, 'optional', !!optional);
  }

  protected setPricingMode(mode: PricingMode | null): void {
    if (!mode) return;
    this.pricingMode.set(mode);
    this.requestCalculation();
  }

  protected getLineItemTotal(item: LineItemDraft): number {
    const calc = this.serverCalc();
    if (calc?.lines) {
      const idx = this.lineItems().indexOf(item);
      const serverLine = calc.lines[idx];
      if (serverLine) return centsToEuros(serverLine.lineTotalCents);
    }
    return parseQuantityNumber(item.quantity) * item.unitPrice;
  }

  // Summary form handlers
  protected setDiscountType(value: DiscountType | null): void {
    if (!value) return;
    this.summaryForm.controls.discountType.setValue(value);
    this.discountType.set(value);
    this.requestCalculation();
  }

  protected setDiscountValue(value: number): void {
    this.summaryForm.controls.discountValue.setValue(value);
    this.discountValue.set(value);
    this.requestCalculation();
  }

  // Save actions
  protected saveDraft(): void {
    this.save('Draft');
  }

  protected saveAndSend(): void {
    this.save('Sent');
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'saveDraft':
        this.saveDraft();
        break;
      case 'saveAndSend':
        this.saveAndSend();
        break;
      case 'cancel':
        this.cancel();
        break;
    }
  }

  private save(status: 'Draft' | 'Sent'): void {
    const lead = this.selectedLead();
    if (!lead || this.lineItems().length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    const payload = this.buildQuotePayload();
    if (!payload) {
      this.saving.set(false);
      return;
    }

    const existing = this.isEditMode() ? this.existingQuote() : null;
    if (existing) {
      this.saveExistingQuote(existing.id, payload, status);
      return;
    }

    this.createNewQuote(lead.id, payload, status);
  }

  private buildQuotePayload(): {
    leadServiceId?: string;
    items: QuoteItemRequest[];
    attachments: QuoteAttachmentRequest[];
    urls: QuoteURLRequest[];
    discountType: DiscountType;
    discountValue: number;
    pricingMode: PricingMode;
    financingDisclaimer: boolean;
    validUntil?: string;
    notes?: string;
  } | null {
    const values = this.summaryForm.getRawValue();
    const dType = values.discountType;
    const dVal = dType === 'fixed' ? eurosToCents(values.discountValue ?? 0) : (values.discountValue ?? 0);

    const items: QuoteItemRequest[] = this.lineItems().map(item => ({
      ...(item.title ? { title: item.title } : {}),
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: eurosToCents(item.unitPrice),
      taxRateBps: taxDisplayToBps(item.taxRate),
      isOptional: item.optional,
      ...(item.catalogProductId ? { catalogProductId: item.catalogProductId } : {}),
    }));

    const attachments: QuoteAttachmentRequest[] = this.attachmentDrafts()
      .filter(a => a.fileKey) // exclude still-uploading entries
      .map((a, i) => ({
        filename: a.filename,
        fileKey: a.fileKey,
        source: a.source,
        ...(a.catalogProductId ? { catalogProductId: a.catalogProductId } : {}),
        enabled: a.enabled,
        sortOrder: i,
      }));

    const urls: QuoteURLRequest[] = this.urlDrafts().map(u => ({
      label: u.label,
      href: u.href,
      ...(u.catalogProductId ? { catalogProductId: u.catalogProductId } : {}),
    }));

    const leadServiceId = this.selectedLeadServiceId();

    return {
      ...(leadServiceId ? { leadServiceId } : {}),
      items,
      attachments,
      urls,
      discountType: dType,
      discountValue: dVal,
      pricingMode: this.pricingMode(),
      financingDisclaimer: this.financingDisclaimer(),
      ...(values.validUntil ? { validUntil: values.validUntil + 'T00:00:00Z' } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    };
  }

  private saveExistingQuote(
    quoteId: string,
    payload: ReturnType<OffertesCreateComponent['buildQuotePayload']> extends infer R ? Exclude<R, null> : never,
    status: 'Draft' | 'Sent',
  ): void {
    this.quotesService.update(quoteId, payload).subscribe({
      next: updated => {
        this.navigateAfterSave(updated.id, status);
        this.saving.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('offertes.errors.save'));
        this.saving.set(false);
      },
    });
  }

  private createNewQuote(
    leadId: string,
    payload: ReturnType<OffertesCreateComponent['buildQuotePayload']> extends infer R ? Exclude<R, null> : never,
    status: 'Draft' | 'Sent',
  ): void {
    this.quotesService.create({ leadId, ...payload }).subscribe({
      next: created => {
        // Upload any pending manual files (deferred from create mode)
        this.uploadPendingFiles(created.id);

        this.navigateAfterSave(created.id, status);
        this.saving.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('offertes.errors.save'));
        this.saving.set(false);
      },
    });
  }

  private navigateAfterSave(quoteId: string, status: 'Draft' | 'Sent'): void {
    if (status !== 'Sent') {
      void this.router.navigate(['/app/offertes', quoteId]);
      return;
    }

    this.quotesService.updateStatus(quoteId, 'Sent').subscribe({
      next: () => void this.router.navigate(['/app/offertes', quoteId]),
      error: () => void this.router.navigate(['/app/offertes', quoteId]),
    });
  }

  protected cancel(): void {
    this.router.navigate(['/app/offertes']);
  }

  // ── AI Generate ─────────────────────────────────────────────────────────────

  protected toggleGeneratePanel(): void {
    this.showGeneratePanel.update(v => !v);
    this.generateError.set(null);
  }

  protected generateQuote(): void {
    const lead = this.selectedLead();
    const serviceId = this.selectedLeadServiceId();
    const prompt = this.generatePrompt().trim();

    if (!lead || !serviceId || !prompt || this.isGenerateLocked()) return;

    this.generating.set(true);
    this.generateError.set(null);

    const existingQuote = this.existingQuote();
    const request: GenerateQuoteRequest = { leadId: lead.id, leadServiceId: serviceId, prompt };
    if (this.isEditMode() && existingQuote) {
      request.quoteId = existingQuote.id;
    }

    this.quotesService.generate(request).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        this.generating.set(false);
        this.currentGenerateJobId.set(result.jobId);
        this.aiJobs.track(result.jobId);
      },
      error: () => {
        this.generating.set(false);
        this.generateError.set(this.translate.instant('offertes.generate.error'));
      },
    });
  }

  protected openGeneratedQuote(): void {
		const job = this.currentGenerateJob();
		if (!job?.quoteId) return;
		if (this.isEditMode() && this.existingQuote()) {
			this.loadQuote(job.quoteId);
			return;
		}
		void this.router.navigate(['/app/offertes', job.quoteId]);
  }

  // ── Catalog Ghost-Text Autocomplete ─────────────────────────────────────────

  /**
   * Search function bound to the ghost-text directive.
   * Returns catalog product suggestions as GhostSuggestion[].
   */
  protected readonly catalogSearchFn = (query: string) =>
    this.catalogService.searchForAutocomplete(query, 10).pipe(
      map(items =>
        items.map(item => ({
          displayText: item.title,
          payload: item,
        } satisfies GhostSuggestion)),
      ),
    );

  /**
   * Called when a ghost-text suggestion is accepted (Tab) for a line item.
   * Populates the line item with catalog product data and collects its documents/urls.
   */
  protected onGhostAccepted(itemId: string, suggestion: GhostSuggestion): void {
    const product = suggestion.payload as AutocompleteItemResponse;
    const requestSeq = (this.materialExpandRequestSeq.get(itemId) ?? 0) + 1;
    this.materialExpandRequestSeq.set(itemId, requestSeq);

    const previousGeneratedIds = this.lineItems()
      .filter(item => item.parentLineItemId === itemId)
      .map(item => item.id);

    // Update the line item with product data
    this.lineItems.update(items => {
      const withoutGenerated = items.filter(item => item.parentLineItemId !== itemId);
      return withoutGenerated.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          title: product.title,
          description: this.formatCatalogDescription(product.title, product.description || ''),
          quantity: item.quantity || '1 x',
          unitPrice: centsToEuros(product.unitPriceCents || product.priceCents),
          taxRate: taxBpsToDisplay(product.vatRateBps),
          catalogProductId: product.id,
        };
      });
    });
    this.descriptionEditState.update(state => ({ ...state, [itemId]: false }));
    if (previousGeneratedIds.length) {
      this.descriptionEditState.update(state => {
        const next = { ...state };
        for (const id of previousGeneratedIds) delete next[id];
        return next;
      });
    }

    // Collect documents from the catalog product
    if (product.documents?.length) {
      const newAttachments: AttachmentDraft[] = product.documents.map((doc, i) => ({
        uid: crypto.randomUUID(),
        filename: doc.filename,
        fileKey: doc.fileKey,
        source: 'catalog' as const,
        catalogProductId: product.id,
        catalogAssetId: doc.id,
        enabled: true,
        sortOrder: this.attachmentDrafts().length + i,
      }));
      this.attachmentDrafts.update(existing => [...existing, ...newAttachments]);
    }

    // Collect URLs (terms & conditions)
    if (product.urls?.length) {
      const newUrls = product.urls.map(url => ({
        uid: crypto.randomUUID(),
        label: url.label,
        href: url.href,
        catalogProductId: product.id,
      }));
      this.urlDrafts.update(existing => [...existing, ...newUrls]);
    }

    this.catalogService.listProductMaterials(product.id).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: materials => {
        if (this.materialExpandRequestSeq.get(itemId) !== requestSeq) return;

        const currentParent = this.lineItems().find(item => item.id === itemId);
        if (currentParent?.catalogProductId !== product.id) return;

        const includedTitles = materials
          .filter(material => material.pricingMode === 'included')
          .map(material => material.title.trim())
          .filter(Boolean);

        const parentDescriptionBase = this.formatCatalogDescription(product.title, product.description || '');
        const parentDescription = this.formatDescriptionWithIncludedMaterials(parentDescriptionBase, includedTitles);

        const generatedRows = this.createGeneratedMaterialRows(itemId, materials, currentParent.taxRate);
        this.lineItems.update(items => {
          const withoutGenerated = items.filter(item => item.parentLineItemId !== itemId);
          const parentIndex = withoutGenerated.findIndex(item => item.id === itemId);
          if (parentIndex === -1) return withoutGenerated;
          const parentLine = withoutGenerated[parentIndex];
          if (!parentLine) return withoutGenerated;

          const updatedParent: LineItemDraft = {
            ...parentLine,
            description: parentDescription,
          };

          return [
            ...withoutGenerated.slice(0, parentIndex),
            updatedParent,
            ...generatedRows,
            ...withoutGenerated.slice(parentIndex + 1),
          ];
        });

        this.descriptionEditState.update(state => {
          const next = { ...state, [itemId]: false };
          for (const row of generatedRows) next[row.id] = false;
          return next;
        });

        this.requestCalculation();
      },
    });

    this.requestCalculation();
  }

  private createGeneratedMaterialRows(parentLineItemId: string, materials: Product[], fallbackTaxRate: TaxRateDisplay): LineItemDraft[] {
    return materials
      .filter(material => material.pricingMode === 'additional' || material.pricingMode === 'optional')
      .map(material => this.createGeneratedMaterialRow(parentLineItemId, material, fallbackTaxRate));
  }

  private createGeneratedMaterialRow(parentLineItemId: string, material: Product, fallbackTaxRate: TaxRateDisplay): LineItemDraft {
    const pricingMode: MaterialPricingMode = material.pricingMode === 'optional' ? 'optional' : 'additional';
    return {
      id: crypto.randomUUID(),
      parentLineItemId,
      title: material.title,
      description: this.formatCatalogDescription(material.title, material.description || ''),
      quantity: '1 x',
      unitPrice: centsToEuros(material.unitPriceCents || material.priceCents),
      taxRate: fallbackTaxRate,
      optional: pricingMode === 'optional',
      catalogProductId: material.id,
    };
  }

  // ── Attachment Panel ────────────────────────────────────────────────────────

  protected onAttachmentsChanged(updated: AttachmentDraft[]): void {
    this.attachmentDrafts.set(updated);
  }

  /**
   * Handles manual file selection for PDF upload.
   * In edit mode: presigns and uploads immediately.
   * In create mode: stores the File in the draft; upload is deferred to save().
   */
  protected onManualUploadRequested(file: File): void {
    const quote = this.existingQuote();
    const tempUid = crypto.randomUUID();
    const draft: AttachmentDraft = {
      uid: tempUid,
      filename: file.name,
      fileKey: '',
      source: 'manual',
      enabled: true,
      sortOrder: this.attachmentDrafts().length,
    };

    if (quote) {
      // Edit mode — upload immediately via presigned URL
      this.attachmentDrafts.update(existing => [...existing, { ...draft, uploading: true }]);
      this.quotesService
        .presignAttachmentUpload(quote.id, {
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })
        .pipe(
          switchMap(presigned =>
            this.quotesService.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
              map(() => presigned.fileKey),
            ),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: fileKey => {
            this.attachmentDrafts.update(items =>
              items.map(a => (a.uid === tempUid ? { ...a, fileKey, uploading: false } : a)),
            );
          },
          error: () => {
            this.attachmentDrafts.update(items => items.filter(a => a.uid !== tempUid));
          },
        });
    } else {
      // Create mode — defer upload until after save creates the quote
      this.attachmentDrafts.update(existing => [...existing, { ...draft, pendingFile: file }]);
    }
  }

  /**
   * After a quote is created, upload any pending manual files and re-save attachments.
   */
  private uploadPendingFiles(quoteId: string): void {
    const pending = this.attachmentDrafts().filter(a => a.pendingFile);
    if (pending.length === 0) return;

    for (const att of pending) {
      const file = att.pendingFile;
      if (!file) continue;
      this.quotesService
        .presignAttachmentUpload(quoteId, {
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })
        .pipe(
          switchMap(presigned =>
            this.quotesService.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
              map(() => presigned.fileKey),
            ),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: fileKey => {
            this.attachmentDrafts.update(items =>
              items.map(a => {
                if (a.uid !== att.uid) return a;
                const { pendingFile: _, ...rest } = a;
                return { ...rest, fileKey, uploading: false };
              }),
            );
            // Re-save attachments on the newly created quote
            this.saveAttachmentsToQuote(quoteId);
          },
        });
    }
  }

  private saveAttachmentsToQuote(quoteId: string): void {
    const attachments: QuoteAttachmentRequest[] = this.attachmentDrafts()
      .filter(a => a.fileKey && !a.pendingFile)
      .map((a, i) => ({
        filename: a.filename,
        fileKey: a.fileKey,
        source: a.source,
        ...(a.catalogProductId ? { catalogProductId: a.catalogProductId } : {}),
        enabled: a.enabled,
        sortOrder: i,
      }));

    const urls: QuoteURLRequest[] = this.urlDrafts().map(u => ({
      label: u.label,
      href: u.href,
      ...(u.catalogProductId ? { catalogProductId: u.catalogProductId } : {}),
    }));

    this.quotesService.update(quoteId, { attachments, urls }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  // ── URL Management ──────────────────────────────────────────────────────────

  protected addUrl(label: string, href: string): void {
    if (!label.trim() || !href.trim()) return;
    this.urlDrafts.update(existing => [
      ...existing,
      { uid: crypto.randomUUID(), label: label.trim(), href: href.trim() },
    ]);
  }

  protected removeUrl(uid: string): void {
    this.urlDrafts.update(existing => existing.filter(u => u.uid !== uid));
  }

  // ── File Preview ────────────────────────────────────────────────────────────

  protected openPreview(att: AttachmentDraft): void {
    const quote = this.existingQuote();

    // 1. For pending (not-yet-uploaded) files, use a local object URL
    if (att.pendingFile) {
      this.previewOpen.set(true);
      this.previewAttachment.set(att);
      this.previewUrl.set(URL.createObjectURL(att.pendingFile));
      this.previewLoading.set(false);
      this.previewError.set(null);
      return;
    }

    // 2. Catalog attachment with known asset ID → use catalog download endpoint
    if (att.source === 'catalog' && att.catalogProductId && att.catalogAssetId) {
      this.previewOpen.set(true);
      this.previewLoading.set(true);
      this.previewError.set(null);
      this.previewUrl.set(null);
      this.previewAttachment.set(att);

      this.catalogService.getCatalogAssetDownloadUrl(att.catalogProductId, att.catalogAssetId).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: response => {
          this.previewUrl.set(response.downloadUrl);
          this.previewLoading.set(false);
        },
        error: () => {
          this.previewError.set(this.translate.instant('offertes.errors.loadPreview'));
          this.previewLoading.set(false);
        },
      });
      return;
    }

    // 3. Saved attachment on a persisted quote → use quote attachment download
    if (!quote) return;

    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewUrl.set(null);
    this.previewAttachment.set(att);

    this.quotesService.getAttachmentDownloadUrl(quote.id, att.uid).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        this.previewUrl.set(response.downloadUrl);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewError.set(this.translate.instant('offertes.errors.loadPreview'));
        this.previewLoading.set(false);
      },
    });
  }

  protected closePreview(): void {
    // Revoke object URL if it was a local preview
    const url = this.previewUrl();
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewUrl.set(null);
    this.previewAttachment.set(null);
  }

  /** Triggers a debounced server-side calculation. */
  private requestCalculation(): void {
    this.calcTrigger$.next();
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private formatCatalogDescription(title: string, descriptionHtml: string): string {
    const safeTitle = this.escapeHtml(title.trim());
    const body = descriptionHtml.trim();
    if (!safeTitle) return body;
    if (!body) return `<p><strong>${safeTitle}</strong></p>`;
    return `<p><strong>${safeTitle}</strong></p>${body}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private formatDescriptionWithIncludedMaterials(baseDescription: string, includedTitles: string[]): string {
    if (includedTitles.length === 0) return baseDescription;

    const includedBlockLines = [this.translate.instant('offertes.includedMaterialsLabel'), ...includedTitles.map(title => `- ${title}`)];
    return `${baseDescription}<br><br>${includedBlockLines.join('<br>')}`;
  }

  private ensureInitialLineItem(): void {
    if (this.lineItems().length === 0) {
      const item = this.createEmptyLineItem();
      this.lineItems.set([item]);
      this.descriptionEditState.set({ [item.id]: true });
    }
  }

  private createEmptyLineItem(): LineItemDraft {
    return {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      quantity: '1 x',
      unitPrice: 0,
      taxRate: this.lastUsedTaxRate(),
      optional: false,
    };
  }
}
