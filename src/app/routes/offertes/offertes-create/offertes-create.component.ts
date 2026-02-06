import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LeadsService } from '../../../core/services/leads.service';
import { QuotesService } from '../../../core/services/quotes.service';
import type { Lead } from '../../../core/services/leads.types';
import type { QuoteResponse, TaxRateDisplay, DiscountType, PricingMode, QuoteItemRequest, QuoteCalculationResponse } from '../../../core/services/quotes.types';
import { TAX_RATE_OPTIONS, DISCOUNT_TYPE_OPTIONS, parseQuantityNumber, eurosToCents, centsToEuros, taxDisplayToBps, taxBpsToDisplay } from '../../../core/services/quotes.types';

import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { SplitActionComponent, type SplitMenuSection } from '../../../shared/components/split-action/split-action.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

interface LineItemDraft {
  id: string;
  description: string;
  quantity: string; // Free-form: "5 x", "10 m²", "3 uur"
  unitPrice: number;
  taxRate: TaxRateDisplay;
  optional: boolean;
}

@Component({
  selector: 'app-offertes-create',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LucideAngularModule,
    AutocompleteComponent,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    SelectComponent,
    SplitActionComponent,
    TextareaComponent,
    PageHeaderComponent,
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
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Server-side calculation trigger
  private readonly calcTrigger$ = new Subject<void>();

  // State
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly existingQuote = signal<QuoteResponse | null>(null);

  // Lead selection
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadOptions = signal<AutocompleteOption[]>([]);
  private readonly leadSuggestions = signal<Lead[]>([]);

  // Line items
  protected readonly lineItems = signal<LineItemDraft[]>([]);

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
    const afterDiscount = subtotal - discountAmount;

    const taxAmount = items.reduce((sum, item) => {
      const lineTotal = parseQuantityNumber(item.quantity) * item.unitPrice;
      const proportion = subtotal > 0 ? lineTotal / subtotal : 0;
      const lineAfterDiscount = afterDiscount * proportion;
      const rate = item.taxRate / 100;
      return sum + (mode === 'exclusive' ? lineAfterDiscount * rate : lineAfterDiscount - lineAfterDiscount / (1 + rate));
    }, 0);

    const total = mode === 'exclusive' ? afterDiscount + taxAmount : afterDiscount;
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
    const dType = this.discountType();
    const dValue = this.discountValue();

    const subtotal = items.reduce((sum, item) => sum + parseQuantityNumber(item.quantity) * item.unitPrice, 0);
    let discountAmount = dType === 'percentage' ? subtotal * (dValue / 100) : dValue;
    discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
    const afterDiscount = subtotal - discountAmount;

    const byRate = new Map<number, number>();
    for (const item of items) {
      const lineTotal = parseQuantityNumber(item.quantity) * item.unitPrice;
      const proportion = subtotal > 0 ? lineTotal / subtotal : 0;
      const lineAfterDiscount = afterDiscount * proportion;
      const rate = item.taxRate / 100;
      const tax = mode === 'exclusive' ? lineAfterDiscount * rate : lineAfterDiscount - lineAfterDiscount / (1 + rate);
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
              quantity: i.quantity,
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
    if (leadId) {
      this.loadLead(leadId);
    }

    // Check for edit mode
    const quoteId = this.route.snapshot.paramMap.get('id');
    if (quoteId) {
      this.isEditMode.set(true);
      this.loadQuote(quoteId);
    } else {
      this.ensureInitialLineItem();
    }
  }

  protected onLeadSearchChange(value: string): void {
    this.leadSearchQuery.set(value);

    if (value.length < 2) {
      this.leadOptions.set([]);
      this.leadSuggestions.set([]);
      return;
    }

    this.leadsService.list({ search: value, pageSize: 10 }).subscribe({
      next: response => {
        this.leadSuggestions.set(response.items);
        this.leadOptions.set(
          response.items.map(lead => ({
            label: `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`,
            value: lead.id,
          }))
        );
      },
      error: () => {
        this.leadOptions.set([]);
      },
    });
  }

  protected onLeadSelected(value: string): void {
    const lead = this.leadSuggestions().find(l => {
      const label = `${l.consumer.firstName} ${l.consumer.lastName} — ${l.address.street} ${l.address.houseNumber}, ${l.address.city}`;
      return label === value || l.id === value;
    });

    if (lead) {
      this.selectedLead.set(lead);
      this.leadSearchQuery.set(
        `${lead.consumer.firstName} ${lead.consumer.lastName} — ${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`
      );
    }
  }

  protected clearLead(): void {
    this.selectedLead.set(null);
    this.leadSearchQuery.set('');
    this.leadOptions.set([]);
    this.leadSuggestions.set([]);
  }

  private loadLead(id: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: lead => {
        this.selectedLead.set(lead);
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
        description: item.description,
        quantity: item.quantity,
        unitPrice: centsToEuros(item.unitPriceCents),
        taxRate: taxBpsToDisplay(item.taxRateBps),
        optional: item.isOptional,
      }))
    );
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
    this.lastUsedTaxRate.set(quote.items.at(0) ? taxBpsToDisplay(quote.items.at(0)!.taxRateBps) : 21);
    this.ensureInitialLineItem();
    this.requestCalculation();
    if (quote.leadId) {
      this.loadLead(quote.leadId);
    }
  }

  // Line item management
  protected addLineItem(): void {
    this.lineItems.update(items => [...items, this.createEmptyLineItem()]);
    this.requestCalculation();
  }

  protected removeLineItem(id: string): void {
    this.lineItems.update(items => {
      if (items.length <= 1) {
        return [this.createEmptyLineItem()];
      }
      return items.filter(item => item.id !== id);
    });
    this.requestCalculation();
  }

  protected updateLineItem(
    id: string,
    field: 'description' | 'quantity' | 'unitPrice' | 'taxRate' | 'optional',
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

    const values = this.summaryForm.getRawValue();
    const dType = values.discountType;
    const dVal = dType === 'fixed' ? eurosToCents(values.discountValue ?? 0) : (values.discountValue ?? 0);
    const items: QuoteItemRequest[] = this.lineItems().map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: eurosToCents(item.unitPrice),
      taxRateBps: taxDisplayToBps(item.taxRate),
      isOptional: item.optional,
    }));

    if (this.isEditMode() && this.existingQuote()) {
      this.quotesService
        .update(this.existingQuote()!.id, {
          items,
          discountType: dType,
          discountValue: dVal,
          pricingMode: this.pricingMode(),
          ...(values.validUntil ? { validUntil: values.validUntil + 'T00:00:00Z' } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        })
        .subscribe({
          next: updated => {
            if (status === 'Sent') {
              this.quotesService.updateStatus(updated.id, 'Sent').subscribe({
                next: () => void this.router.navigate(['/app/offertes', updated.id]),
                error: () => void this.router.navigate(['/app/offertes', updated.id]),
              });
            } else {
              void this.router.navigate(['/app/offertes', updated.id]);
            }
            this.saving.set(false);
          },
          error: () => {
            this.error.set(this.translate.instant('offertes.errors.save'));
            this.saving.set(false);
          },
        });
    } else {
      this.quotesService
        .create({
          leadId: lead.id,
          items,
          discountType: dType,
          discountValue: dVal,
          pricingMode: this.pricingMode(),
          ...(values.validUntil ? { validUntil: values.validUntil + 'T00:00:00Z' } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        })
        .subscribe({
          next: created => {
            if (status === 'Sent') {
              this.quotesService.updateStatus(created.id, 'Sent').subscribe({
                next: () => void this.router.navigate(['/app/offertes', created.id]),
                error: () => void this.router.navigate(['/app/offertes', created.id]),
              });
            } else {
              void this.router.navigate(['/app/offertes', created.id]);
            }
            this.saving.set(false);
          },
          error: () => {
            this.error.set(this.translate.instant('offertes.errors.save'));
            this.saving.set(false);
          },
        });
    }
  }

  protected cancel(): void {
    this.router.navigate(['/app/offertes']);
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

  private ensureInitialLineItem(): void {
    if (this.lineItems().length === 0) {
      this.lineItems.set([this.createEmptyLineItem()]);
    }
  }

  private createEmptyLineItem(): LineItemDraft {
    return {
      id: crypto.randomUUID(),
      description: '',
      quantity: '1 x',
      unitPrice: 0,
      taxRate: this.lastUsedTaxRate(),
      optional: false,
    };
  }
}
