import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  CdkDragStart,
  CdkDragEnd,
} from '@angular/cdk/drag-drop';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  EMPTY,
  Subject,
  Observable,
  debounceTime,
  switchMap,
  map,
  catchError,
  of,
  forkJoin,
} from 'rxjs';

import { LeadsService } from '../../../core/services/leads.service';
import { QuotesService } from '../../../core/services/quotes.service';
import { OrganizationService } from '../../../core/services/organization.service';
import {
  CatalogService,
  type AutocompleteItemResponse,
  type MaterialPricingMode,
  type Product,
} from '../../../core/services/catalog.service';
import { AIJobService } from '../../../core/services/ai-job.service';
import { IsdeService } from '../../../core/services/isde.service';
import type { Lead } from '../../../core/services/leads.types';
import type {
  QuoteResponse,
  QuoteISDESubsidy,
  TaxRateDisplay,
  DiscountType,
  PricingMode,
  QuoteItemRequest,
  QuoteCalculationResponse,
  QuoteAttachmentRequest,
  QuoteURLRequest,
  GenerateQuoteRequest,
  CreateQuoteFeedbackRequest,
  AnalyzeSubsidyDraftRequest,
  AnalyzeSubsidyDraftResult,
} from '../../../core/services/quotes.types';
import type {
  ISDECalculationRequest,
  ISDECalculationResponse,
} from '../../../core/services/isde.types';
import {
  TAX_RATE_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  parseQuantityNumber,
  eurosToCents,
  centsToEuros,
  taxDisplayToBps,
  taxBpsToDisplay,
  derivePostcodePrefixZip4,
} from '../../../core/services/quotes.types';
import { UserService } from '../../../core/services/user.service';

import {
  AutocompleteComponent,
  type AutocompleteOption,
} from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';
import {
  SelectComponent,
  type SelectOption,
} from '../../../shared/components/select/select.component';
import {
  SplitActionComponent,
  type SplitMenuSection,
} from '../../../shared/components/split-action/split-action.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { type GhostSuggestion } from '../../../shared/components/ghost-text/ghost-text.directive';
import {
  AttachmentPanelComponent,
  type AttachmentDraft,
} from '../../../shared/components/attachment-panel/attachment-panel.component';
import { FilePreviewDialogComponent } from '../../../shared/components/file-preview-dialog/file-preview-dialog.component';
import { BottomSheetComponent } from '../../../shared/components/bottom-sheet';
import { QuoteLineItemRowComponent } from './quote-line-item-row.component';
import { QuotePricingIntelligencePanelComponent } from '../quote-pricing-intelligence-panel/quote-pricing-intelligence-panel.component';
import type {
  EditableSubsidyInstallationField,
  EditableSubsidyMeasureField,
  EditableSubsidyValue,
  ISDEMeasureID,
  LineItemDraft,
  SubsidyInstallationDraft,
  SubsidyMeasureDraft,
  UrlDraft,
} from './offertes-create.models';
import {
  buildQuoteHydrationSnapshot,
  buildQuoteDraftPayload,
  buildQuoteFeedbackRequests,
  type QuoteDraftPayload,
} from './offertes-create-quote.utils';
import {
  applySubsidyInstallationUpdate,
  applySubsidyMeasureUpdate,
  buildSubsidyMeasuresFromAIResult,
  createDefaultSubsidyInstallation,
  createDefaultSubsidyMeasure,
  createDraftUid,
  defaultSubsidyExecutionYear,
  inferSubsidyMeasureFromLineItem,
  installationUsesHeatPumpFormula,
  installationUsesMeldcode,
  ISDE_EXECUTION_YEAR_OPTIONS,
  ISDE_HEAT_PUMP_LABEL_OPTIONS,
  ISDE_HEAT_PUMP_TYPE_OPTIONS,
  ISDE_INSTALLATION_KIND_OPTIONS,
  ISDE_MEASURE_OPTIONS,
  measureNeedsFrameFields,
  measurePerformanceExample,
  measurePerformanceHint,
  measureSupportsMKI,
  measureSupportsPairStacking,
  toRequestedInstallation,
  toRequestedMeasure,
  toSubsidyInstallationDraft,
  toSubsidyMeasureDraft,
} from './offertes-create-subsidy.utils';

@Component({
  selector: 'app-offertes-create',
  imports: [
    NgTemplateOutlet,
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
    BottomSheetComponent,
    QuoteLineItemRowComponent,
    QuotePricingIntelligencePanelComponent,
  ],
  templateUrl: './offertes-create.component.html',
  styleUrl: './offertes-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class OffertesCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly quotesService = inject(QuotesService);
  private readonly orgService = inject(OrganizationService);
  private readonly catalogService = inject(CatalogService);
  private readonly aiJobs = inject(AIJobService);
  private readonly isdeService = inject(IsdeService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);
  private readonly materialExpandRequestSeq = new Map<string, number>();
  private readonly createUid = () => createDraftUid();

  private readonly currentUser = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

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
  protected readonly currentGenerateJob = computed(() =>
    this.aiJobs.job(this.currentGenerateJobId()),
  );
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
    this.leadServices().map((s) => ({ label: s.serviceType, value: s.id })),
  );
  protected readonly selectedLeadServiceLabel = computed(() => {
    const id = this.selectedLeadServiceId();
    if (!id) return null;
    return this.leadServices().find((s) => s.id === id)?.serviceType ?? null;
  });
  protected readonly isAdmin = computed(
    () => this.currentUser()?.roles?.includes('admin') ?? false,
  );
  protected readonly pricingIntelligenceServiceType = computed(() =>
    this.selectedLeadServiceLabel(),
  );
  protected readonly pricingIntelligencePostcodePrefix = computed(() =>
    derivePostcodePrefixZip4(this.selectedLead()?.address.zipCode),
  );
  protected readonly quoteId = computed(() => {
    const fromRoute = this.route.snapshot.paramMap.get('id');
    if (fromRoute) return fromRoute;
    return this.existingQuote()?.id ?? null;
  });

  // Lead selection
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadOptions = signal<AutocompleteOption[]>([]);
  private readonly leadSuggestions = signal<Lead[]>([]);

  private static readonly CREATE_LEAD_OPTION_VALUE = '__create_new_lead__';

  // Line items
  protected readonly lineItems = signal<LineItemDraft[]>([]);
  protected readonly isDraggingLineItems = signal(false);
  protected readonly descriptionEditState = signal<Record<string, boolean>>({});

  // Document attachments & URLs (collected from catalog autocomplete + manual uploads)
  protected readonly attachmentDrafts = signal<AttachmentDraft[]>([]);
  protected readonly urlDrafts = signal<UrlDraft[]>([]);

  // File preview dialog state
  protected readonly previewOpen = signal(false);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly previewAttachment = signal<AttachmentDraft | null>(null);
  protected readonly previewTitle = computed(
    () => this.previewAttachment()?.filename ?? 'File preview',
  );
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

  // Subsidy summary state
  protected readonly includeSubsidyInSummary = signal(false);
  protected readonly subsidyEditorOpen = signal(false);
  protected readonly subsidyCalculating = signal(false);
  protected readonly subsidyError = signal<string | null>(null);
  protected readonly subsidyResult = signal<ISDECalculationResponse | null>(null);
  protected readonly subsidyAnalysisJobId = signal<string | null>(null);
  protected readonly subsidyAnalysisLoading = signal(false);
  protected readonly subsidyAnalysisStep = signal<string | null>(null);
  protected readonly subsidyAnalysisProgress = signal<number | null>(null);
  protected readonly subsidyNotice = signal<string | null>(null);
  protected readonly lastCalculatedSubsidyFingerprint = signal<string | null>(null);
  protected readonly lastSubsidyAnalysisSourceFingerprint = signal<string | null>(null);
  protected readonly subsidyExecutionYear = signal(
    new Date().getFullYear() >= 2026 ? 2026 : Math.max(new Date().getFullYear(), 2024),
  );
  protected readonly previousSubsidiesWithin24Months = signal(false);
  protected readonly hasExistingWarmtenetConnection = signal(false);
  protected readonly hasReceivedWarmtenetSubsidy = signal(false);
  protected readonly subsidyMeasures = signal<SubsidyMeasureDraft[]>([]);
  protected readonly subsidyInstallations = signal<SubsidyInstallationDraft[]>([]);
  protected readonly subsidyMeasureOptions = signal(ISDE_MEASURE_OPTIONS);
  protected readonly subsidyInstallationKindOptions = signal(ISDE_INSTALLATION_KIND_OPTIONS);
  protected readonly subsidyHeatPumpTypeOptions = signal(ISDE_HEAT_PUMP_TYPE_OPTIONS);
  protected readonly subsidyHeatPumpLabelOptions = signal(ISDE_HEAT_PUMP_LABEL_OPTIONS);
  protected readonly subsidyExecutionYearOptions = signal(ISDE_EXECUTION_YEAR_OPTIONS);
  protected readonly isMobileViewport = signal(false);
  protected readonly hasSubsidyResult = computed(
    () => this.subsidyResult()?.totalAmountCents != null,
  );
  protected readonly subsidyTotalEuros = computed(() =>
    centsToEuros(this.subsidyResult()?.totalAmountCents ?? 0),
  );
  protected readonly subsidyBreakdownRows = computed(() => {
    const result = this.subsidyResult();
    if (!result) return [];
    return [...result.insulationBreakdown, ...result.glassBreakdown, ...result.installations];
  });

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
  protected readonly discountSuffix = computed(() =>
    this.discountType() === 'percentage' ? '%' : '',
  );
  protected readonly pricingModeOptions = computed<SelectOption<PricingMode>[]>(() => [
    { label: this.translate.instant('offertes.pricesExclVat'), value: 'exclusive' },
    { label: this.translate.instant('offertes.pricesInclVat'), value: 'inclusive' },
  ]);

  // Options for selects
  protected readonly taxRateOptions = computed<SelectOption<TaxRateDisplay>[]>(() =>
    TAX_RATE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value })),
  );

  protected readonly discountTypeOptions = computed<SelectOption<DiscountType>[]>(() =>
    DISCOUNT_TYPE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value })),
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
    const items = this.lineItems().filter((i) => !i.optional);
    const mode = this.pricingMode();
    const dType = this.discountType();
    const dValue = this.discountValue();
    const subtotal = items.reduce(
      (sum, item) => sum + parseQuantityNumber(item.quantity) * this.getUnitPriceValue(item),
      0,
    );

    let discountAmount = dType === 'percentage' ? subtotal * (dValue / 100) : dValue;
    discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);

    const taxAmount = items.reduce((sum, item) => {
      const lineTotal = parseQuantityNumber(item.quantity) * this.getUnitPriceValue(item);
      const rate = item.taxRate / 100;
      return sum + (mode === 'exclusive' ? lineTotal * rate : lineTotal - lineTotal / (1 + rate));
    }, 0);

    const total =
      mode === 'exclusive' ? subtotal - discountAmount + taxAmount : subtotal - discountAmount;
    return { subtotal, discountAmount, taxAmount, total };
  });

  protected readonly taxBreakdown = computed(() => {
    const calc = this.serverCalc();
    if (calc?.vatBreakdown?.length) {
      return calc.vatBreakdown
        .filter((b) => b.amountCents > 0)
        .map((b) => ({ rate: b.rateBps / 100, amount: centsToEuros(b.amountCents) }))
        .sort((a, b) => b.rate - a.rate);
    }
    // Client-side fallback
    const items = this.lineItems().filter((i) => !i.optional);
    const mode = this.pricingMode();

    const byRate = new Map<number, number>();
    for (const item of items) {
      const lineTotal = parseQuantityNumber(item.quantity) * this.getUnitPriceValue(item);
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
    this.bindViewportMode();

    // Wire up debounced server-side calculation
    this.calcTrigger$
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const validItems = this.lineItems().filter((i) => i.description.trim() !== '');
          if (validItems.length === 0) {
            this.serverCalc.set(null);
            this.calculating.set(false);
            return [];
          }
          this.calculating.set(true);
          const dType = this.discountType();
          const dVal =
            dType === 'fixed' ? eurosToCents(this.discountValue()) : this.discountValue();
          return this.quotesService.calculate({
            items: validItems.map((i) => ({
              description: i.description,
              quantity: i.quantity || '1',
              unitPriceCents: eurosToCents(this.getUnitPriceValue(i)),
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
        next: (result) => {
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
    this.orgService
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
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
    const selectedOption = this.leadOptions().find((o) => o.label === value);
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
      next: (response) => {
        this.leadSuggestions.set(response.items);
        const options = response.items.map((lead) => ({
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
    const selectedOption = this.leadOptions().find((o) => o.label === value);
    if (selectedOption?.value === OffertesCreateComponent.CREATE_LEAD_OPTION_VALUE) {
      const returnTo = this.router.url.split('?')[0] ?? '/app/offertes/new';
      this.router.navigate(['/app/leads/new'], { queryParams: { returnTo, source: 'quote_flow' } });
      return;
    }

    const leadId = selectedOption?.value;
    const lead = leadId ? this.leadSuggestions().find((l) => l.id === leadId) : null;

    if (lead) {
      this.selectedLead.set(lead);
      // Default to the first service; user can change it explicitly.
      this.selectedLeadServiceId.set(lead.services?.[0]?.id ?? null);
      this.leadSearchQuery.set(
        `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`,
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
      next: (lead) => {
        this.selectedLead.set(lead);
        const nextServiceId =
          preferredServiceId && lead.services?.some((s) => s.id === preferredServiceId)
            ? preferredServiceId
            : (lead.services?.[0]?.id ?? null);
        this.selectedLeadServiceId.set(nextServiceId);
        this.leadSearchQuery.set(
          `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`,
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
      next: (quote) => {
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
    const snapshot = buildQuoteHydrationSnapshot(quote);

    this.existingQuote.set(quote);
    this.lineItems.set(snapshot.lineItems);
    this.descriptionEditState.set(snapshot.descriptionEditState);
    this.attachmentDrafts.set(snapshot.attachmentDrafts);
    this.urlDrafts.set(snapshot.urlDrafts);
    this.summaryForm.patchValue(snapshot.summary);
    this.discountType.set(snapshot.summary.discountType);
    this.discountValue.set(snapshot.discountDisplayValue);
    this.pricingMode.set(snapshot.pricingMode);
    this.financingDisclaimer.set(snapshot.financingDisclaimer);
    this.applyQuoteSubsidyState(quote.isdeSubsidy);
    this.lastUsedTaxRate.set(snapshot.lastUsedTaxRate);
    this.ensureInitialLineItem();
    this.requestCalculation();
    if (quote.leadId) {
      this.loadLead(quote.leadId, quote.leadServiceId);
    }
  }

  // Line item management
  protected addLineItem(): void {
    const item = this.createEmptyLineItem();
    this.lineItems.update((items) => [...items, item]);
    this.descriptionEditState.update((state) => ({ ...state, [item.id]: true }));
    this.requestCalculation();
  }

  protected removeLineItem(id: string): void {
    const removedGeneratedIds = this.lineItems()
      .filter((item) => item.parentLineItemId === id)
      .map((item) => item.id);

    this.lineItems.update((items) => {
      if (items.length <= 1) {
        const item = this.createEmptyLineItem();
        this.descriptionEditState.set({ [item.id]: true });
        return [item];
      }
      return items.filter((item) => item.id !== id && item.parentLineItemId !== id);
    });
    this.descriptionEditState.update((state) => {
      const next = { ...state };
      delete next[id];
      for (const generatedId of removedGeneratedIds) delete next[generatedId];
      return next;
    });
    this.requestCalculation();
  }

  protected onLineItemDragStarted(_event: CdkDragStart): void {
    this.isDraggingLineItems.set(true);
  }

  protected onLineItemDragEnded(_event: CdkDragEnd): void {
    this.isDraggingLineItems.set(false);
  }

  protected onLineItemDrop(event: CdkDragDrop<LineItemDraft[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.lineItems.update((items) => {
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
    this.descriptionEditState.update((state) => ({ ...state, [item.id]: editing }));
  }

  protected updateLineItem(
    id: string,
    field: 'title' | 'description' | 'quantity' | 'unitPrice' | 'taxRate' | 'optional',
    value: string | number | boolean | null,
  ): void {
    this.lineItems.update((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      }),
    );
    this.requestCalculation();
  }

  protected updateLineItemPrice(id: string, price: number | null): void {
    this.updateLineItem(id, 'unitPrice', price);
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
    if (calc?.lines && item.description.trim() !== '') {
      const validItems = this.lineItems().filter((lineItem) => lineItem.description.trim() !== '');
      const validIndex = validItems.findIndex((lineItem) => lineItem.id === item.id);
      const serverLine = validIndex >= 0 ? calc.lines[validIndex] : undefined;
      if (serverLine) return centsToEuros(serverLine.lineTotalCents);
    }
    return parseQuantityNumber(item.quantity) * this.getUnitPriceValue(item);
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

  protected openSubsidyEditor(): void {
    if (this.subsidyAnalysisLoading()) {
      return;
    }

    const currentAnalysisFingerprint = this.buildSubsidyAnalysisSourceFingerprint();
    const hasExistingSubsidyData =
      this.subsidyMeasures().length > 0 || this.subsidyInstallations().length > 0;
    const subsidyAnalysisIsCurrent =
      currentAnalysisFingerprint !== null &&
      currentAnalysisFingerprint === this.lastSubsidyAnalysisSourceFingerprint();

    if (hasExistingSubsidyData && subsidyAnalysisIsCurrent) {
      this.subsidyEditorOpen.set(true);
      this.subsidyError.set(null);
      this.subsidyNotice.set(null);
      return;
    }

    const payload = this.buildSubsidyAnalysisDraftPayload();
    if (!payload) {
      this.subsidyEditorOpen.set(true);
      this.subsidyError.set('Voeg eerst een regel toe met omschrijving en hoeveelheid om subsidie te laten analyseren.');
      this.subsidyNotice.set(null);
      this.prefillSubsidyFromLineItems();
      return;
    }

    this.subsidyEditorOpen.set(false);
    this.subsidyError.set(null);
    this.subsidyNotice.set(null);
    this.subsidyAnalysisLoading.set(true);
    this.subsidyAnalysisStep.set('AI analyseert de offertelijnen');
    this.subsidyAnalysisProgress.set(null);
    this.subsidyMeasures.set([]);
    this.subsidyInstallations.set([]);

    this.quotesService.analyzeSubsidyDraft(payload).subscribe({
      next: (response) => {
        this.subsidyAnalysisLoading.set(false);
        this.subsidyAnalysisStep.set(null);
        this.subsidyAnalysisProgress.set(null);
        this.subsidyNotice.set(
          hasExistingSubsidyData
            ? 'AI voorstel vernieuwd op basis van de aangepaste offertelijnen. Controleer de waarden voordat je berekent.'
            : 'AI voorstel ingevuld. Controleer de waarden voordat je berekent.',
        );
        this.prefillFromAISuggestion(response.result);
        this.subsidyEditorOpen.set(true);
      },
      error: () => {
        this.subsidyAnalysisLoading.set(false);
        this.subsidyAnalysisStep.set(null);
        this.subsidyAnalysisProgress.set(null);
        this.subsidyError.set('AI analyse mislukt. Controleer of de voorgestelde subsidie klopt.');
        this.subsidyNotice.set('De velden zijn ingevuld op basis van de huidige regels.');
        this.prefillSubsidyFromLineItems();
        this.subsidyEditorOpen.set(true);
      },
    });
  }

  private prefillFromAISuggestion(result: AnalyzeSubsidyDraftResult): void {
    const inferredMeasures = this.getSubsidyAnalysisSourceItems()
      .map((item) => inferSubsidyMeasureFromLineItem(item, this.createUid))
      .filter((row): row is SubsidyMeasureDraft => row !== null);
    const measures = buildSubsidyMeasuresFromAIResult(result, inferredMeasures, this.createUid);

    if (measures.length > 0) {
      this.subsidyMeasures.set(measures);
    }

    if (result.installation_meldcode_id) {
      this.subsidyInstallations.set([
        {
          uid: this.createUid(),
          kind: 'meldcode',
          meldcode: result.installation_meldcode_id,
          heatPumpType: 'air_water',
          heatPumpEnergyLabel: 'A++',
          isAdditionalUnit: false,
          isSplitSystem: false,
        }
      ]);
    }

    this.lastSubsidyAnalysisSourceFingerprint.set(this.buildSubsidyAnalysisSourceFingerprint());
  }
  private prefillSubsidyFromLineItems(): void {
    const measures = this.getSubsidyAnalysisSourceItems()
      .map((item) => inferSubsidyMeasureFromLineItem(item, this.createUid))
      .filter((row): row is SubsidyMeasureDraft => row !== null);

    if (measures.length > 0) {
      this.subsidyMeasures.set(measures);
      this.lastSubsidyAnalysisSourceFingerprint.set(this.buildSubsidyAnalysisSourceFingerprint());
      return;
    }

    if (this.subsidyMeasures().length === 0 && this.subsidyInstallations().length === 0) {
      this.subsidyMeasures.set([createDefaultSubsidyMeasure(this.createUid)]);
    }

    this.lastSubsidyAnalysisSourceFingerprint.set(this.buildSubsidyAnalysisSourceFingerprint());
  }

  private buildSubsidyAnalysisSourceFingerprint(): string | null {
    const payload = this.buildSubsidyAnalysisDraftPayload();
    return payload ? JSON.stringify(payload.items) : null;
  }

  private buildSubsidyAnalysisDraftPayload(): AnalyzeSubsidyDraftRequest | null {
    const items: QuoteItemRequest[] = this.getSubsidyAnalysisSourceItems()
      .filter((item) => item.description.trim() !== '' || item.title.trim() !== '')
      .map((item) => ({
        ...(item.title ? { title: item.title } : {}),
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: eurosToCents(this.getUnitPriceValue(item)),
        taxRateBps: taxDisplayToBps(item.taxRate),
        isOptional: item.optional,
      }));

    if (items.length === 0) {
      return null;
    }

    return { items };
  }

  private getSubsidyAnalysisSourceItems(): LineItemDraft[] {
    const items = this.lineItems();
    const liveDescriptions = this.readLiveSubsidyDescriptions();
    const liveQuantities = this.readLiveSubsidyQuantities();

    return items.map((item, index) => ({
      ...item,
      description: liveDescriptions[index] ?? item.description,
      quantity: liveQuantities[index] ?? item.quantity,
    }));
  }

  private readLiveSubsidyDescriptions(): string[] {
    if (globalThis.document === undefined) {
      return [];
    }

    return Array.from(globalThis.document.querySelectorAll<HTMLElement>('app-quote-line-item-row .ql-editor'))
      .filter((element) => this.isElementVisible(element))
      .map((element) => element.innerHTML.trim())
      .filter((value) => value !== '');
  }

  private readLiveSubsidyQuantities(): string[] {
    if (globalThis.document === undefined) {
      return [];
    }

    return Array.from(
      globalThis.document.querySelectorAll<HTMLInputElement>('app-quote-line-item-row input[placeholder="1, 10 m2, 1 stuk"]'),
    )
      .filter((element) => this.isElementVisible(element))
      .map((element) => element.value.trim())
      .filter((value) => value !== '');
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = globalThis.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  protected closeSubsidyEditor(): void {
    this.subsidyEditorOpen.set(false);
    this.subsidyError.set(null);
    this.subsidyAnalysisLoading.set(false);
    this.subsidyAnalysisStep.set(null);
    this.subsidyAnalysisProgress.set(null);
    this.subsidyNotice.set(null);
  }

  protected addSubsidyMeasureRow(): void {
    this.subsidyMeasures.update((rows) => [...rows, createDefaultSubsidyMeasure(this.createUid)]);
  }

  protected removeSubsidyMeasureRow(uid: string): void {
    this.subsidyMeasures.update((rows) => rows.filter((row) => row.uid !== uid));
  }

  protected addSubsidyInstallationRow(): void {
    this.subsidyInstallations.update((rows) => [
      ...rows,
      createDefaultSubsidyInstallation(this.createUid),
    ]);
  }

  protected removeSubsidyInstallationRow(uid: string): void {
    this.subsidyInstallations.update((rows) => rows.filter((row) => row.uid !== uid));
  }

  protected updateSubsidyMeasure(
    uid: string,
    field: EditableSubsidyMeasureField,
    value: EditableSubsidyValue,
  ): void {
    this.subsidyMeasures.update((rows) =>
      rows.map((row) => (row.uid === uid ? applySubsidyMeasureUpdate(row, field, value) : row)),
    );
  }

  protected updateSubsidyInstallation(
    uid: string,
    field: EditableSubsidyInstallationField,
    value: EditableSubsidyValue,
  ): void {
    this.subsidyInstallations.update((rows) =>
      rows.map((row) =>
        row.uid === uid ? applySubsidyInstallationUpdate(row, field, value) : row,
      ),
    );
  }

  protected calculateSubsidy(): void {
    const payload = this.buildSubsidyCalculationPayload();

    if (!payload) {
      this.subsidyError.set(
        'Voeg minstens een maatregel of meldcode toe om subsidie te berekenen.',
      );
      return;
    }

    this.subsidyCalculating.set(true);
    this.subsidyError.set(null);
    this.isdeService
      .calculate(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.subsidyResult.set(result);
          this.lastCalculatedSubsidyFingerprint.set(
            this.serializeSubsidyCalculationPayload(payload),
          );
          if ((result.validationMessages?.length ?? 0) > 0) {
            this.subsidyError.set(result.validationMessages?.join(' ') ?? null);
            this.subsidyCalculating.set(false);
            return;
          }
          this.includeSubsidyInSummary.set(true);
          this.subsidyCalculating.set(false);
          this.closeSubsidyEditor();
        },
        error: () => {
          this.subsidyCalculating.set(false);
          this.subsidyError.set(
            'Subsidieberekening mislukt. Controleer de invoer en probeer opnieuw.',
          );
        },
      });
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

    if (this.hasAttachmentUploadsInProgress()) {
      this.error.set(this.translate.instant('offertes.errors.save'));
      return;
    }

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

  private buildQuotePayload(): QuoteDraftPayload {
    return buildQuoteDraftPayload({
      summary: this.summaryForm.getRawValue(),
      lineItems: this.lineItems(),
      attachmentDrafts: this.attachmentDrafts(),
      urlDrafts: this.urlDrafts(),
      leadServiceId: this.selectedLeadServiceId(),
      pricingMode: this.pricingMode(),
      financingDisclaimer: this.financingDisclaimer(),
      isdeSubsidy: this.buildQuoteSubsidyPayload(),
      getUnitPriceValue: (item) => this.getUnitPriceValue(item),
    });
  }

  private saveExistingQuote(
    quoteId: string,
    payload: QuoteDraftPayload,
    status: 'Draft' | 'Sent',
  ): void {
    const feedbackRequests = buildQuoteFeedbackRequests({
      quote: this.existingQuote(),
      lineItems: this.lineItems(),
      leadServiceId: this.selectedLeadServiceId(),
      getUnitPriceValue: (item) => this.getUnitPriceValue(item),
    });
    this.quotesService.update(quoteId, payload).subscribe({
      next: (updated) => {
        this.submitQuoteFeedbackInBackground(updated.id, feedbackRequests);
        this.navigateAfterSave(updated.id, status, feedbackRequests.length);
        this.saving.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('offertes.errors.save'));
        this.saving.set(false);
      },
    });
  }

  private buildSubsidyCalculationPayload(): ISDECalculationRequest | null {
    const measures = this.subsidyMeasures()
      .filter((row) => row.measureId && row.areaM2 > 0)
      .map((row) => toRequestedMeasure(row));
    const installations = this.subsidyInstallations()
      .filter((row) => {
        if (row.kind === 'meldcode') return row.meldcode.trim().length > 0;
        if (row.kind === 'heat_pump') return row.thermalPowerKW != null && row.thermalPowerKW > 0;
        return true;
      })
      .map((row) => toRequestedInstallation(row));

    if (measures.length === 0 && installations.length === 0) {
      return null;
    }

    return {
      executionYear: this.subsidyExecutionYear(),
      previousSubsidiesWithin24Months: this.previousSubsidiesWithin24Months(),
      hasExistingWarmtenetConnection: this.hasExistingWarmtenetConnection(),
      hasReceivedWarmtenetSubsidy: this.hasReceivedWarmtenetSubsidy(),
      measures,
      installations,
    };
  }

  private buildQuoteSubsidyPayload(): QuoteISDESubsidy {
    const input = this.buildSubsidyCalculationPayload();
    const inputFingerprint = this.serializeSubsidyCalculationPayload(input);
    const result =
      inputFingerprint !== null && inputFingerprint === this.lastCalculatedSubsidyFingerprint()
        ? (this.subsidyResult() ?? undefined)
        : undefined;

    return {
      includeInSummary: this.includeSubsidyInSummary(),
      ...(input ? { input } : {}),
      ...(result ? { result } : {}),
    };
  }

  private applyQuoteSubsidyState(snapshot: QuoteISDESubsidy | undefined): void {
    if (!snapshot) {
      this.resetSubsidyState();
      return;
    }

    this.includeSubsidyInSummary.set(snapshot.includeInSummary ?? false);

    if (!snapshot.input) {
      this.subsidyMeasures.set([]);
      this.subsidyInstallations.set([]);
      this.subsidyResult.set(snapshot.result ?? null);
      this.lastCalculatedSubsidyFingerprint.set(null);
      this.lastSubsidyAnalysisSourceFingerprint.set(null);
      return;
    }

    const defaultExecutionYear = defaultSubsidyExecutionYear();
    this.subsidyExecutionYear.set(snapshot.input.executionYear ?? defaultExecutionYear);
    this.previousSubsidiesWithin24Months.set(!!snapshot.input.previousSubsidiesWithin24Months);
    this.hasExistingWarmtenetConnection.set(!!snapshot.input.hasExistingWarmtenetConnection);
    this.hasReceivedWarmtenetSubsidy.set(!!snapshot.input.hasReceivedWarmtenetSubsidy);
    this.subsidyMeasures.set(
      (snapshot.input.measures ?? []).map((measure) => toSubsidyMeasureDraft(measure, this.createUid)),
    );
    this.subsidyInstallations.set(
      (snapshot.input.installations ?? []).map((installation) =>
        toSubsidyInstallationDraft(installation, this.createUid),
      ),
    );
    this.subsidyResult.set(snapshot.result ?? null);
    this.lastCalculatedSubsidyFingerprint.set(
      this.serializeSubsidyCalculationPayload(snapshot.input),
    );
    this.lastSubsidyAnalysisSourceFingerprint.set(this.buildSubsidyAnalysisSourceFingerprint());
  }

  private resetSubsidyState(): void {
    const defaultExecutionYear = defaultSubsidyExecutionYear();
    this.includeSubsidyInSummary.set(false);
    this.subsidyResult.set(null);
    this.lastCalculatedSubsidyFingerprint.set(null);
    this.lastSubsidyAnalysisSourceFingerprint.set(null);
    this.subsidyExecutionYear.set(defaultExecutionYear);
    this.previousSubsidiesWithin24Months.set(false);
    this.hasExistingWarmtenetConnection.set(false);
    this.hasReceivedWarmtenetSubsidy.set(false);
    this.subsidyMeasures.set([]);
    this.subsidyInstallations.set([]);
  }

  private serializeSubsidyCalculationPayload(
    payload: ISDECalculationRequest | null,
  ): string | null {
    if (!payload) {
      return null;
    }
    return JSON.stringify(payload);
  }

  private submitQuoteFeedbackInBackground(
    quoteId: string,
    requests: CreateQuoteFeedbackRequest[],
  ): void {
    for (const request of requests) {
      this.quotesService
        .submitFeedback(quoteId, request)
        .pipe(
          catchError(() => EMPTY),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
    }
  }

  private createNewQuote(
    leadId: string,
    payload: QuoteDraftPayload,
    status: 'Draft' | 'Sent',
  ): void {
    this.quotesService
      .create({ leadId, ...payload })
      .pipe(
        switchMap((created) =>
          this.uploadPendingFiles(created.id).pipe(
            switchMap(() => this.sendIfRequested(created.id, status)),
            map(() => created.id),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (quoteId) => {
          this.navigateToQuote(quoteId, 0);
          this.saving.set(false);
        },
        error: () => {
          this.clearPendingUploadFlags();
          this.error.set(this.translate.instant('offertes.errors.save'));
          this.saving.set(false);
        },
      });
  }

  private sendIfRequested(quoteId: string, status: 'Draft' | 'Sent'): Observable<void> {
    if (status !== 'Sent') {
      return of(void 0);
    }
    return this.quotesService.updateStatus(quoteId, 'Sent').pipe(map(() => void 0));
  }

  private navigateToQuote(quoteId: string, feedbackCount: number): void {
    const navigationExtras =
      feedbackCount > 0 ? { state: { aiFeedbackCount: feedbackCount } } : undefined;
    void this.router.navigate(['/app/offertes', quoteId], navigationExtras);
  }

  private navigateAfterSave(
    quoteId: string,
    status: 'Draft' | 'Sent',
    feedbackCount: number,
  ): void {
    const navigationExtras =
      feedbackCount > 0 ? { state: { aiFeedbackCount: feedbackCount } } : undefined;

    if (status !== 'Sent') {
      void this.router.navigate(['/app/offertes', quoteId], navigationExtras);
      return;
    }

    this.quotesService.updateStatus(quoteId, 'Sent').subscribe({
      next: () => void this.router.navigate(['/app/offertes', quoteId], navigationExtras),
      error: () => void this.router.navigate(['/app/offertes', quoteId], navigationExtras),
    });
  }

  protected cancel(): void {
    this.router.navigate(['/app/offertes']);
  }

  // ── AI Generate ─────────────────────────────────────────────────────────────

  protected toggleGeneratePanel(): void {
    this.showGeneratePanel.update((v) => !v);
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

    this.quotesService
      .generate(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
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
      map((items) =>
        items.map(
          (item) =>
            ({
              displayText: item.title,
              payload: item,
            }) satisfies GhostSuggestion,
        ),
      ),
    );

  /**
   * Called when a ghost-text suggestion is accepted (Tab) for a line item.
   * Populates the line item with catalog product data and collects its documents/urls.
   */
  protected onGhostAccepted(itemId: string, suggestion: GhostSuggestion): void {
    const product = suggestion.payload as AutocompleteItemResponse;
    const catalogProductId = this.catalogProductId(product);
    const requestSeq = (this.materialExpandRequestSeq.get(itemId) ?? 0) + 1;
    this.materialExpandRequestSeq.set(itemId, requestSeq);

    const previousGeneratedIds = this.lineItems()
      .filter((item) => item.parentLineItemId === itemId)
      .map((item) => item.id);

    // Snapshot the description set at ghost-accept time so the async materials
    // callback can detect whether the user manually changed it before the fetch
    // resolved, and avoid overwriting those manual edits.
    const initialDescription = this.formatAutocompleteDescription(product);

    // Update the line item with product data
    this.lineItems.update((items) => {
      const withoutGenerated = items.filter((item) => item.parentLineItemId !== itemId);
      return withoutGenerated.map((item) => {
        if (item.id !== itemId) return item;

        const updatedItem = {
          ...item,
          title: product.title,
          description: initialDescription,
          quantity: item.quantity || '1 x',
          unitPrice: centsToEuros(product.unitPriceCents || product.priceCents),
          taxRate: taxBpsToDisplay(product.vatRateBps),
        };

        if (catalogProductId) {
          return { ...updatedItem, catalogProductId };
        }

        const { catalogProductId: _catalogProductId, ...withoutCatalogProductId } = updatedItem;
        return withoutCatalogProductId;
      });
    });
    this.descriptionEditState.update((state) => ({ ...state, [itemId]: false }));
    if (previousGeneratedIds.length) {
      this.descriptionEditState.update((state) => {
        const next = { ...state };
        for (const id of previousGeneratedIds) delete next[id];
        return next;
      });
    }

    // Collect documents from the catalog product
    if (catalogProductId && product.documents?.length) {
      const newAttachments: AttachmentDraft[] = product.documents.map((doc, i) => ({
        uid: crypto.randomUUID(),
        filename: doc.filename,
        fileKey: doc.fileKey,
        source: 'catalog' as const,
        catalogProductId,
        catalogAssetId: doc.id,
        enabled: true,
        sortOrder: this.attachmentDrafts().length + i,
      }));
      this.attachmentDrafts.update((existing) => [...existing, ...newAttachments]);
    }

    // Collect URLs (terms & conditions)
    if (catalogProductId && product.urls?.length) {
      const newUrls = product.urls.map((url) => ({
        uid: crypto.randomUUID(),
        label: url.label,
        href: url.href,
        catalogProductId,
      }));
      this.urlDrafts.update((existing) => [...existing, ...newUrls]);
    }

    if (!catalogProductId) {
      this.requestCalculation();
      return;
    }

    this.catalogService
      .listProductMaterials(catalogProductId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (materials) => {
          if (this.materialExpandRequestSeq.get(itemId) !== requestSeq) return;

          const currentParent = this.lineItems().find((item) => item.id === itemId);
          if (currentParent?.catalogProductId !== catalogProductId) return;
          // If the user manually edited the description after accepting the ghost
          // suggestion, don't overwrite their changes with the materials list.
          if (currentParent.description !== initialDescription) return;

          const includedTitles = materials
            .filter((material) => material.pricingMode === 'included')
            .map((material) => material.title.trim())
            .filter(Boolean);

          const parentDescriptionBase = this.formatCatalogDescription(
            product.title,
            product.description || '',
          );
          const parentDescription = this.formatDescriptionWithIncludedMaterials(
            parentDescriptionBase,
            includedTitles,
          );

          const generatedRows = this.createGeneratedMaterialRows(
            itemId,
            materials,
            currentParent.taxRate,
          );
          this.lineItems.update((items) => {
            const withoutGenerated = items.filter((item) => item.parentLineItemId !== itemId);
            const parentIndex = withoutGenerated.findIndex((item) => item.id === itemId);
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

          this.descriptionEditState.update((state) => {
            const next = { ...state, [itemId]: false };
            for (const row of generatedRows) next[row.id] = false;
            return next;
          });

          this.requestCalculation();
        },
      });

    this.requestCalculation();
  }

  private createGeneratedMaterialRows(
    parentLineItemId: string,
    materials: Product[],
    fallbackTaxRate: TaxRateDisplay,
  ): LineItemDraft[] {
    return materials
      .filter(
        (material) => material.pricingMode === 'additional' || material.pricingMode === 'optional',
      )
      .map((material) =>
        this.createGeneratedMaterialRow(parentLineItemId, material, fallbackTaxRate),
      );
  }

  private createGeneratedMaterialRow(
    parentLineItemId: string,
    material: Product,
    fallbackTaxRate: TaxRateDisplay,
  ): LineItemDraft {
    const pricingMode: MaterialPricingMode =
      material.pricingMode === 'optional' ? 'optional' : 'additional';
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
      this.attachmentDrafts.update((existing) => [...existing, { ...draft, uploading: true }]);
      this.quotesService
        .presignAttachmentUpload(quote.id, {
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
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (fileKey) => {
            this.attachmentDrafts.update((items) =>
              items.map((a) => (a.uid === tempUid ? { ...a, fileKey, uploading: false } : a)),
            );
          },
          error: () => {
            this.attachmentDrafts.update((items) => items.filter((a) => a.uid !== tempUid));
          },
        });
    } else {
      // Create mode — defer upload until after save creates the quote
      this.attachmentDrafts.update((existing) => [...existing, { ...draft, pendingFile: file }]);
    }
  }

  /**
   * After a quote is created, upload any pending manual files and re-save attachments.
   */
  private uploadPendingFiles(quoteId: string): Observable<void> {
    const pending = this.attachmentDrafts().filter((a) => a.pendingFile);
    if (pending.length === 0) return of(void 0);

    this.attachmentDrafts.update((items) =>
      items.map((item) => (item.pendingFile ? { ...item, uploading: true } : item)),
    );

    const uploads = pending.map((att) => {
      const file = att.pendingFile;
      if (!file) {
        return of({ uid: att.uid, fileKey: '' });
      }

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
              .pipe(map(() => ({ uid: att.uid, fileKey: presigned.fileKey }))),
          ),
        );
    });

    return forkJoin(uploads).pipe(
      switchMap((results) => {
        const fileKeyByUid = new Map(results.map((result) => [result.uid, result.fileKey]));

        this.attachmentDrafts.update((items) =>
          items.map((item) => {
            const fileKey = fileKeyByUid.get(item.uid);
            if (!fileKey) {
              return item.pendingFile ? { ...item, uploading: false } : item;
            }
            const { pendingFile: _pendingFile, ...rest } = item;
            return { ...rest, fileKey, uploading: false };
          }),
        );

        return this.saveAttachmentsToQuote(quoteId).pipe(map(() => void 0));
      }),
    );
  }

  private saveAttachmentsToQuote(quoteId: string): Observable<QuoteResponse> {
    const attachments: QuoteAttachmentRequest[] = this.attachmentDrafts()
      .filter((a) => a.fileKey && !a.pendingFile)
      .map((a, i) => ({
        filename: a.filename,
        fileKey: a.fileKey,
        source: a.source,
        ...(a.catalogProductId ? { catalogProductId: a.catalogProductId } : {}),
        enabled: a.enabled,
        sortOrder: i,
      }));

    const urls: QuoteURLRequest[] = this.urlDrafts().map((u) => ({
      label: u.label,
      href: u.href,
      ...(u.catalogProductId ? { catalogProductId: u.catalogProductId } : {}),
    }));

    return this.quotesService.update(quoteId, { attachments, urls });
  }

  private clearPendingUploadFlags(): void {
    this.attachmentDrafts.update((items) =>
      items.map((item) => (item.pendingFile ? { ...item, uploading: false } : item)),
    );
  }

  private hasAttachmentUploadsInProgress(): boolean {
    return this.attachmentDrafts().some((item) => item.uploading);
  }

  // ── URL Management ──────────────────────────────────────────────────────────

  protected addUrl(label: string, href: string): void {
    if (!label.trim() || !href.trim()) return;
    this.urlDrafts.update((existing) => [
      ...existing,
      { uid: crypto.randomUUID(), label: label.trim(), href: href.trim() },
    ]);
  }

  protected removeUrl(uid: string): void {
    this.urlDrafts.update((existing) => existing.filter((u) => u.uid !== uid));
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

      this.catalogService
        .getCatalogAssetDownloadUrl(att.catalogProductId, att.catalogAssetId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
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

    this.quotesService
      .getAttachmentDownloadUrl(quote.id, att.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
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
    this.serverCalc.set(null);
    this.calcTrigger$.next();
  }

  private getUnitPriceValue(item: Pick<LineItemDraft, 'unitPrice'>): number {
    return item.unitPrice ?? 0;
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private catalogProductId(item: AutocompleteItemResponse): string | undefined {
    if (item.sourceType !== 'catalog') {
      return undefined;
    }
    return item.catalogProductId ?? item.id;
  }

  private formatAutocompleteDescription(item: AutocompleteItemResponse): string {
    if (item.sourceType === 'catalog') {
      return this.formatCatalogDescription(item.title, item.description ?? '');
    }

    return this.formatReferenceDescription(item.title, item.description ?? '');
  }

  private formatCatalogDescription(title: string, descriptionHtml: string): string {
    const safeTitle = this.escapeHtml(title.trim());
    const body = descriptionHtml.trim();
    if (!safeTitle) return body;
    if (!body) return `<p><strong>${safeTitle}</strong></p>`;
    return `<p><strong>${safeTitle}</strong></p>${body}`;
  }

  private formatReferenceDescription(title: string, description: string): string {
    const safeTitle = this.escapeHtml(title.trim());
    const safeBody = this.escapeHtml(description.trim()).replaceAll('\n', '<br>');
    if (!safeTitle) {
      return safeBody;
    }
    if (!safeBody) {
      return `<p><strong>${safeTitle}</strong></p>`;
    }
    return `<p><strong>${safeTitle}</strong></p><p>${safeBody}</p>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private formatDescriptionWithIncludedMaterials(
    baseDescription: string,
    includedTitles: string[],
  ): string {
    if (includedTitles.length === 0) return baseDescription;

    const includedBlockLines = [
      this.translate.instant('offertes.includedMaterialsLabel'),
      ...includedTitles.map((title) => `- ${title}`),
    ];
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
      unitPrice: null,
      taxRate: this.lastUsedTaxRate(),
      optional: false,
    };
  }

  private bindViewportMode(): void {
    if (globalThis.window === undefined || typeof globalThis.window.matchMedia !== 'function') {
      this.isMobileViewport.set(false);
      return;
    }

    const mediaQuery = globalThis.window.matchMedia('(max-width: 767px)');
    this.isMobileViewport.set(mediaQuery.matches);

    const updateViewport = (event: MediaQueryListEvent) => {
      this.isMobileViewport.set(event.matches);
    };

    mediaQuery.addEventListener('change', updateViewport);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', updateViewport));
  }

  protected measurePerformanceLabel(measureId: ISDEMeasureID): string {
    return (
      this.subsidyMeasureOptions().find((opt) => opt.value === measureId)?.performanceLabel ??
      'Prestatie'
    );
  }

  protected readonly measurePerformanceHint = measurePerformanceHint;
  protected readonly measurePerformanceExample = measurePerformanceExample;
  protected readonly measureNeedsFrameFields = measureNeedsFrameFields;
  protected readonly measureSupportsMKI = measureSupportsMKI;
  protected readonly measureSupportsPairStacking = measureSupportsPairStacking;
  protected readonly installationUsesMeldcode = installationUsesMeldcode;
  protected readonly installationUsesHeatPumpFormula = installationUsesHeatPumpFormula;

}
