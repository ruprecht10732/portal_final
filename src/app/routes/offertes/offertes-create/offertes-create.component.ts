import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { LeadsService } from '../../../core/services/leads.service';
import { QuotesService } from '../../../core/services/quotes.service';
import type { Lead } from '../../../core/services/leads.types';
import type { Quote, TaxRate, DiscountType, PricingMode } from '../../../core/services/quotes.types';
import { TAX_RATE_OPTIONS, DISCOUNT_TYPE_OPTIONS, parseQuantityNumber } from '../../../core/services/quotes.types';

import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { SplitActionComponent, type SplitMenuSection } from '../../../shared/components/split-action/split-action.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';

interface LineItemDraft {
  id: string;
  description: string;
  quantity: string; // Free-form: "5 x", "10 m²", "3 uur"
  unitPrice: number;
  taxRate: TaxRate;
  optional: boolean;
}

@Component({
  selector: 'app-offertes-create',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LucideAngularModule,
    AutocompleteComponent,
    ButtonComponent,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    SelectComponent,
    SplitActionComponent,
    TextareaComponent,
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

  // State
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly existingQuote = signal<Quote | null>(null);

  // Lead selection
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadOptions = signal<AutocompleteOption[]>([]);
  private readonly leadSuggestions = signal<Lead[]>([]);

  // Line items
  protected readonly lineItems = signal<LineItemDraft[]>([]);

  // Remember last VAT choice for new lines
  protected readonly lastUsedTaxRate = signal<TaxRate>(21);
  protected readonly pricingMode = signal<PricingMode>('exclusive');

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
  protected readonly taxRateOptions = computed<SelectOption<TaxRate>[]>(() =>
    TAX_RATE_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))
  );

  protected readonly discountTypeOptions = computed<SelectOption<DiscountType>[]>(() =>
    DISCOUNT_TYPE_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))
  );

  // Calculated totals
  protected readonly totals = computed(() => {
    const items = this.lineItems();
    return this.quotesService.calculateTotals(
      items,
      this.discountType(),
      this.discountValue(),
      this.pricingMode()
    );
  });

  protected readonly taxBreakdown = computed(() => {
    return this.quotesService.calculateTaxBreakdown(
      this.lineItems(),
      this.discountType(),
      this.discountValue(),
      this.pricingMode()
    );
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
        if (quote) {
          this.existingQuote.set(quote);
          this.lineItems.set(
            quote.lineItems.map(item => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate ?? 21,
              optional: item.optional ?? false,
            }))
          );
          this.summaryForm.patchValue({
            discountType: quote.discountType,
            discountValue: quote.discountValue,
            validUntil: quote.validUntil ?? '',
            notes: quote.notes ?? '',
          });
          this.discountType.set(quote.discountType);
          this.discountValue.set(quote.discountValue);
          this.pricingMode.set(quote.pricingMode ?? 'exclusive');
          this.lastUsedTaxRate.set(quote.lineItems.at(0)?.taxRate ?? 21);
          this.ensureInitialLineItem();
          if (quote.leadId) {
            this.loadLead(quote.leadId);
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translate.instant('offertes.errors.loadQuote'));
      },
    });
  }

  // Line item management
  protected addLineItem(): void {
    this.lineItems.update(items => [...items, this.createEmptyLineItem()]);
  }

  protected removeLineItem(id: string): void {
    this.lineItems.update(items => {
      if (items.length <= 1) {
        return [this.createEmptyLineItem()];
      }
      return items.filter(item => item.id !== id);
    });
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
  }

  protected updateLineItemPrice(id: string, price: number | null): void {
    this.updateLineItem(id, 'unitPrice', price ?? 0);
  }

  protected updateLineItemTaxRate(id: string, rate: TaxRate | null): void {
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
  }

  protected getLineItemTotal(item: LineItemDraft): number {
    return parseQuantityNumber(item.quantity) * item.unitPrice;
  }

  // Summary form handlers
  protected setDiscountType(value: DiscountType | null): void {
    if (!value) return;
    this.summaryForm.controls.discountType.setValue(value);
    this.discountType.set(value);
  }

  protected setDiscountValue(value: number): void {
    this.summaryForm.controls.discountValue.setValue(value);
    this.discountValue.set(value);
  }

  // Save actions
  protected saveDraft(): void {
    this.save('draft');
  }

  protected saveAndSend(): void {
    this.save('sent');
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

  private save(status: 'draft' | 'sent'): void {
    const lead = this.selectedLead();
    if (!lead || this.lineItems().length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.summaryForm.getRawValue();
    const items = this.lineItems().map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      optional: item.optional,
    }));

    if (this.isEditMode() && this.existingQuote()) {
      this.quotesService
        .update(this.existingQuote()!.id, {
          lineItems: items,
          discountType: values.discountType,
          discountValue: values.discountValue ?? 0,
          pricingMode: this.pricingMode(),
          validUntil: values.validUntil || undefined,
          notes: values.notes || undefined,
        })
        .subscribe({
          next: updated => {
            if (updated && status === 'sent') {
              this.quotesService.updateStatus(updated.id, 'sent').subscribe({
                next: () => void this.router.navigate(['/app/offertes', updated.id]),
                error: () => void this.router.navigate(['/app/offertes', updated.id]),
              });
            } else if (updated) {
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
          lineItems: items,
          discountType: values.discountType,
          discountValue: values.discountValue ?? 0,
          pricingMode: this.pricingMode(),
          validUntil: values.validUntil || undefined,
          notes: values.notes || undefined,
        })
        .subscribe({
          next: created => {
            if (status === 'sent') {
              this.quotesService.updateStatus(created.id, 'sent').subscribe({
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
