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
  debounceTime,
  switchMap,
  catchError,
  of,
} from 'rxjs';

import { LeadsService } from '../../../core/services/leads.service';
import { QuotesService } from '../../../core/services/quotes.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AIJobService } from '../../../core/services/ai-job.service';
import { IsdeService } from '../../../core/services/isde.service';
import type { Lead } from '../../../core/services/leads.types';
import type {
  QuoteResponse,
  QuoteISDESubsidy,
  TaxRateDisplay,
  DiscountType,
  PricingMode,
  QuoteCalculationResponse,
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
import {
  OffertesCreateAttachmentsService,
  type AttachmentPreviewState,
} from './offertes-create-attachments.service';
import { OffertesCreatePersistenceService } from './offertes-create-persistence.service';
import {
  acceptGhostSuggestion,
  buildGhostAcceptanceDescriptionState,
  buildMaterialExpansionDescriptionState,
  expandAcceptedMaterials,
  searchCatalogSuggestions,
} from './offertes-create-catalog.utils';
import {
  buildSubsidyAnalysisDraftPayload as buildDraftSubsidyAnalysisPayload,
  buildSubsidyAnalysisSourceFingerprint as buildDraftSubsidyAnalysisSourceFingerprint,
  getSubsidyAnalysisSourceItems as getDraftSubsidyAnalysisSourceItems,
} from './offertes-create-subsidy-analysis.utils';
import {
  addLineItemEditorState,
  ensureInitialLineItemState,
  getLineItemTotal as getDraftLineItemTotal,
  isDescriptionEditing as isLineItemDescriptionEditing,
  reorderLineItems,
  removeLineItemEditorState,
  setDescriptionEditing as setLineItemDescriptionEditing,
  updateLineItemValue,
} from './offertes-create-line-items.utils';
import { QuoteLineItemRowComponent } from './quote-line-item-row.component';
import { QuotePricingIntelligencePanelComponent } from '../quote-pricing-intelligence-panel/quote-pricing-intelligence-panel.component';
import {
  buildCreateLeadOption,
  buildLeadAutocompleteOptions,
  CREATE_LEAD_OPTION_VALUE,
  deriveLeadSelectionState,
} from './offertes-create-lead.utils';
import type {
  DescriptionEditState,
  EditableSubsidyInstallationField,
  EditableSubsidyMeasureField,
  EditableSubsidyValue,
  ISDEMeasureID,
  LineItemField,
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
  addSubsidyInstallationRow,
  addSubsidyMeasureRow,
  buildAISubsidyPrefillSnapshot,
  buildAppliedQuoteSubsidyState,
  buildLineItemSubsidyPrefillSnapshot,
  createDraftUid,
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
  removeSubsidyInstallationRow,
  removeSubsidyMeasureRow,
  serializeSubsidyCalculationPayload as serializeDraftSubsidyCalculationPayload,
  toRequestedInstallation,
  toRequestedMeasure,
  updateSubsidyInstallationRow,
  updateSubsidyMeasureRow,
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
  private readonly attachmentsService = inject(OffertesCreateAttachmentsService);
  private readonly persistenceService = inject(OffertesCreatePersistenceService);
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

  // Line items
  protected readonly lineItems = signal<LineItemDraft[]>([]);
  protected readonly isDraggingLineItems = signal(false);
  protected readonly descriptionEditState = signal<DescriptionEditState>({});

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
    if (selectedOption?.value === CREATE_LEAD_OPTION_VALUE) {
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      this.leadSuggestions.set([]);
      this.leadOptions.set(
        query
          ? [
              buildCreateLeadOption(
                this.translate.instant('offertes.leadAutocomplete.createNewWithQuery', { query }),
              ),
            ]
          : [],
      );
      return;
    }

    this.leadsService.list({ search: value, pageSize: 10 }).subscribe({
      next: (response) => {
        this.leadSuggestions.set(response.items);
        this.leadOptions.set(
          buildLeadAutocompleteOptions(
            response.items,
            buildCreateLeadOption(
              this.translate.instant('offertes.leadAutocomplete.createNewWithQuery', { query }),
            ),
          ),
        );
      },
      error: () => {
        this.leadSuggestions.set([]);
        this.leadOptions.set(
          query
            ? [
                buildCreateLeadOption(
                  this.translate.instant('offertes.leadAutocomplete.createNewWithQuery', { query }),
                ),
              ]
            : [],
        );
      },
    });
  }

  protected onLeadSelected(value: string): void {
    const selectedOption = this.leadOptions().find((o) => o.label === value);
    if (selectedOption?.value === CREATE_LEAD_OPTION_VALUE) {
      const returnTo = this.router.url.split('?')[0] ?? '/app/offertes/new';
      this.router.navigate(['/app/leads/new'], { queryParams: { returnTo, source: 'quote_flow' } });
      return;
    }

    const leadId = selectedOption?.value;
    const lead = leadId ? this.leadSuggestions().find((l) => l.id === leadId) : null;

    if (lead) {
      const selection = deriveLeadSelectionState(lead);
      this.selectedLead.set(lead);
      this.selectedLeadServiceId.set(selection.selectedLeadServiceId);
      this.leadSearchQuery.set(selection.leadSearchLabel);
    }
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
        const selection = deriveLeadSelectionState(lead, preferredServiceId);
        this.selectedLead.set(lead);
        this.selectedLeadServiceId.set(selection.selectedLeadServiceId);
        this.leadSearchQuery.set(selection.leadSearchLabel);
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
    const nextState = addLineItemEditorState({
      lineItems: this.lineItems(),
      descriptionEditState: this.descriptionEditState(),
      lastUsedTaxRate: this.lastUsedTaxRate(),
      createUid: this.createUid,
    });
    this.lineItems.set(nextState.lineItems);
    this.descriptionEditState.set(nextState.descriptionEditState);
    this.requestCalculation();
  }

  protected removeLineItem(id: string): void {
    const nextState = removeLineItemEditorState({
      lineItems: this.lineItems(),
      descriptionEditState: this.descriptionEditState(),
      id,
      lastUsedTaxRate: this.lastUsedTaxRate(),
      createUid: this.createUid,
    });
    this.lineItems.set(nextState.lineItems);
    this.descriptionEditState.set(nextState.descriptionEditState);
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
    this.lineItems.set(
      reorderLineItems(this.lineItems(), event.previousIndex, event.currentIndex),
    );
    this.requestCalculation();
  }

  protected isDescriptionEditing(item: LineItemDraft): boolean {
    return isLineItemDescriptionEditing(item, this.descriptionEditState());
  }

  protected setDescriptionEditing(item: LineItemDraft, editing: boolean): void {
    this.descriptionEditState.set(
      setLineItemDescriptionEditing(this.descriptionEditState(), item.id, editing),
    );
  }

  protected updateLineItem(
    id: string,
    field: LineItemField,
    value: string | number | boolean | null,
  ): void {
    this.lineItems.set(updateLineItemValue(this.lineItems(), id, field, value));
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
    return getDraftLineItemTotal({
      item,
      lineItems: this.lineItems(),
      serverCalc: this.serverCalc(),
      getUnitPriceValue: (lineItem) => this.getUnitPriceValue(lineItem),
    });
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
    const snapshot = buildAISubsidyPrefillSnapshot({
      result,
      sourceItems: this.getSubsidyAnalysisSourceItems(),
      createUid: this.createUid,
      buildAnalysisSourceFingerprint: () => this.buildSubsidyAnalysisSourceFingerprint(),
    });

    this.subsidyMeasures.set(snapshot.subsidyMeasures);
    this.subsidyInstallations.set(snapshot.subsidyInstallations);
    this.lastSubsidyAnalysisSourceFingerprint.set(snapshot.lastSubsidyAnalysisSourceFingerprint);
  }

  private prefillSubsidyFromLineItems(): void {
    const snapshot = buildLineItemSubsidyPrefillSnapshot({
      sourceItems: this.getSubsidyAnalysisSourceItems(),
      existingMeasures: this.subsidyMeasures(),
      existingInstallations: this.subsidyInstallations(),
      createUid: this.createUid,
      buildAnalysisSourceFingerprint: () => this.buildSubsidyAnalysisSourceFingerprint(),
    });

    this.subsidyMeasures.set(snapshot.subsidyMeasures);
    this.subsidyInstallations.set(snapshot.subsidyInstallations);
    this.lastSubsidyAnalysisSourceFingerprint.set(snapshot.lastSubsidyAnalysisSourceFingerprint);
  }

  private buildSubsidyAnalysisSourceFingerprint(): string | null {
    return buildDraftSubsidyAnalysisSourceFingerprint(this.buildSubsidyAnalysisDraftPayload());
  }

  private buildSubsidyAnalysisDraftPayload(): AnalyzeSubsidyDraftRequest | null {
    return buildDraftSubsidyAnalysisPayload({
      lineItems: this.getSubsidyAnalysisSourceItems(),
      getUnitPriceValue: (item) => this.getUnitPriceValue(item),
    });
  }

  private getSubsidyAnalysisSourceItems(): LineItemDraft[] {
    return getDraftSubsidyAnalysisSourceItems(this.lineItems());
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
    this.subsidyMeasures.set(addSubsidyMeasureRow(this.subsidyMeasures(), this.createUid));
  }

  protected removeSubsidyMeasureRow(uid: string): void {
    this.subsidyMeasures.set(removeSubsidyMeasureRow(this.subsidyMeasures(), uid));
  }

  protected addSubsidyInstallationRow(): void {
    this.subsidyInstallations.set(
      addSubsidyInstallationRow(this.subsidyInstallations(), this.createUid),
    );
  }

  protected removeSubsidyInstallationRow(uid: string): void {
    this.subsidyInstallations.set(
      removeSubsidyInstallationRow(this.subsidyInstallations(), uid),
    );
  }

  protected updateSubsidyMeasure(
    uid: string,
    field: EditableSubsidyMeasureField,
    value: EditableSubsidyValue,
  ): void {
    this.subsidyMeasures.set(
      updateSubsidyMeasureRow(this.subsidyMeasures(), uid, field, value),
    );
  }

  protected updateSubsidyInstallation(
    uid: string,
    field: EditableSubsidyInstallationField,
    value: EditableSubsidyValue,
  ): void {
    this.subsidyInstallations.set(
      updateSubsidyInstallationRow(this.subsidyInstallations(), uid, field, value),
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

    if (this.attachmentsService.hasUploadsInProgress(this.attachmentDrafts())) {
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
      const feedbackRequests = buildQuoteFeedbackRequests({
        quote: this.existingQuote(),
        lineItems: this.lineItems(),
        leadServiceId: this.selectedLeadServiceId(),
        getUnitPriceValue: (item) => this.getUnitPriceValue(item),
      });

      this.persistenceService
        .saveExistingQuote({
          quoteId: existing.id,
          payload,
          status,
        })
        .subscribe({
          next: (quoteId) => {
            this.submitQuoteFeedbackInBackground(quoteId, feedbackRequests);
            this.navigateToQuote(quoteId, feedbackRequests.length);
            this.saving.set(false);
          },
          error: () => {
            this.error.set(this.translate.instant('offertes.errors.save'));
            this.saving.set(false);
          },
        });
      return;
    }

    const nextAttachmentDrafts = this.attachmentsService.markPendingUploads(this.attachmentDrafts());
    this.attachmentDrafts.set(nextAttachmentDrafts);

    this.persistenceService
      .createNewQuote({
        leadId: lead.id,
        payload,
        status,
        attachmentDrafts: nextAttachmentDrafts,
        urlDrafts: this.urlDrafts(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ quoteId, attachmentDrafts }) => {
          this.attachmentDrafts.set(attachmentDrafts);
          this.navigateToQuote(quoteId, 0);
          this.saving.set(false);
        },
        error: () => {
          this.attachmentDrafts.set(
            this.attachmentsService.clearPendingUploadFlags(this.attachmentDrafts()),
          );
          this.error.set(this.translate.instant('offertes.errors.save'));
          this.saving.set(false);
        },
      });
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
    const nextState = buildAppliedQuoteSubsidyState({
      snapshot,
      createUid: this.createUid,
      buildAnalysisSourceFingerprint: () => this.buildSubsidyAnalysisSourceFingerprint(),
    });

    this.includeSubsidyInSummary.set(nextState.includeInSummary);
    this.subsidyResult.set(nextState.subsidyResult);
    this.lastCalculatedSubsidyFingerprint.set(nextState.lastCalculatedSubsidyFingerprint);
    this.lastSubsidyAnalysisSourceFingerprint.set(nextState.lastSubsidyAnalysisSourceFingerprint);
    this.subsidyExecutionYear.set(nextState.subsidyExecutionYear);
    this.previousSubsidiesWithin24Months.set(nextState.previousSubsidiesWithin24Months);
    this.hasExistingWarmtenetConnection.set(nextState.hasExistingWarmtenetConnection);
    this.hasReceivedWarmtenetSubsidy.set(nextState.hasReceivedWarmtenetSubsidy);
    this.subsidyMeasures.set(nextState.subsidyMeasures);
    this.subsidyInstallations.set(nextState.subsidyInstallations);
  }

  private serializeSubsidyCalculationPayload(
    payload: ISDECalculationRequest | null,
  ): string | null {
    return serializeDraftSubsidyCalculationPayload(payload);
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

  private navigateToQuote(quoteId: string, feedbackCount: number): void {
    const navigationExtras =
      feedbackCount > 0 ? { state: { aiFeedbackCount: feedbackCount } } : undefined;
    void this.router.navigate(['/app/offertes', quoteId], navigationExtras);
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
    searchCatalogSuggestions(this.catalogService, query);

  /**
   * Called when a ghost-text suggestion is accepted (Tab) for a line item.
   * Populates the line item with catalog product data and collects its documents/urls.
   */
  protected onGhostAccepted(itemId: string, suggestion: GhostSuggestion): void {
    const { accepted, product, requestSeq } = acceptGhostSuggestion({
      itemId,
      suggestion,
      lineItems: this.lineItems(),
      attachmentCount: this.attachmentDrafts().length,
      createUid: this.createUid,
    });

    this.lineItems.set(accepted.nextLineItems);
    this.descriptionEditState.update((state) =>
      buildGhostAcceptanceDescriptionState({
        state,
        itemId,
        previousGeneratedIds: accepted.previousGeneratedIds,
      }),
    );

    if (accepted.newAttachments.length > 0) {
      this.attachmentDrafts.update((existing) => [...existing, ...accepted.newAttachments]);
    }

    if (accepted.newUrls.length > 0) {
      this.urlDrafts.update((existing) => [...existing, ...accepted.newUrls]);
    }

    if (!accepted.catalogProductId) {
      this.requestCalculation();
      return;
    }

    expandAcceptedMaterials(this.catalogService, {
        itemId,
        requestSeq,
        accepted,
        product,
        includedMaterialsLabel: this.translate.instant('offertes.includedMaterialsLabel'),
        createUid: this.createUid,
        getLineItems: () => this.lineItems(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (expansion) => {
          if (!expansion) {
            return;
          }

          this.lineItems.set(expansion.nextLineItems);

          this.descriptionEditState.update((state) =>
            buildMaterialExpansionDescriptionState({
              state,
              itemId,
              generatedRows: expansion.generatedRows,
            }),
          );

          this.requestCalculation();
        },
      });

    this.requestCalculation();
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
    const plan = this.attachmentsService.createManualUploadPlan({
      file,
      quoteId: this.existingQuote()?.id ?? null,
      drafts: this.attachmentDrafts(),
      createUid: this.createUid,
    });

    this.attachmentDrafts.set(plan.nextDrafts);

    if (!plan.upload$) {
      return;
    }

    const uploadedDraftUid = plan.nextDrafts.at(-1)?.uid;
    if (!uploadedDraftUid) {
      return;
    }

    plan.upload$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (drafts) => {
          this.attachmentDrafts.set(drafts);
        },
        error: () => {
          this.attachmentDrafts.update((items) =>
            this.attachmentsService.removeDraft(items, uploadedDraftUid),
          );
        },
      });
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
    const plan = this.attachmentsService.buildRemotePreviewOpenPlan(
      att,
      this.existingQuote()?.id ?? null,
    );

    if (!plan) {
      return;
    }

    this.applyPreviewState(plan.state);

    if (!plan.remoteUrl$) {
      return;
    }

    plan.remoteUrl$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (downloadUrl) => {
          const nextState = this.attachmentsService.buildRemotePreviewSuccessState(
            att,
            downloadUrl,
          );
          this.applyPreviewState(nextState);
        },
        error: () => {
          const nextState = this.attachmentsService.buildRemotePreviewErrorState(
            att,
            this.translate.instant('offertes.errors.loadPreview'),
          );
          this.applyPreviewState(nextState);
        },
      });
  }

  protected closePreview(): void {
    const nextState = this.attachmentsService.buildClosedPreviewState(this.previewUrl());
    this.applyPreviewState(nextState);
  }

  private applyPreviewState(state: AttachmentPreviewState): void {
    this.previewOpen.set(state.previewOpen);
    this.previewLoading.set(state.previewLoading);
    this.previewError.set(state.previewError);
    this.previewUrl.set(state.previewUrl);
    this.previewAttachment.set(state.previewAttachment);
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

  private ensureInitialLineItem(): void {
    const nextState = ensureInitialLineItemState({
      lineItems: this.lineItems(),
      descriptionEditState: this.descriptionEditState(),
      lastUsedTaxRate: this.lastUsedTaxRate(),
      createUid: this.createUid,
    });
    this.lineItems.set(nextState.lineItems);
    this.descriptionEditState.set(nextState.descriptionEditState);
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
