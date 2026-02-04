import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { type Product } from '../../../../core/services/catalog.service';
import { ChipComponent, type ChipVariant } from '../../../../shared/components/chip/chip.component';

interface DetailsRow {
  labelKey: string;
  value: string | null;
  variant?: ChipVariant;
  valueType?: 'text' | 'price' | 'chip';
}

@Component({
  selector: 'app-catalog-detail-basics-card',
  imports: [DatePipe, TranslateModule, ChipComponent],
  templateUrl: './catalog-detail-basics-card.component.html',
  styleUrl: './catalog-detail-basics-card.component.css',
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailBasicsCardComponent {
  readonly product = input.required<Product>();
  readonly heroImageUrl = input<string | null>(null);
  readonly formattedVatRate = input.required<string>();
  readonly formattedPrice = input.required<string>();
  readonly typeLabel = input.required<string>();
  readonly typeVariant = input.required<ChipVariant>();
  readonly createdAt = input.required<string | Date>();
  readonly updatedAt = input.required<string | Date>();

  protected readonly detailsRows = computed<DetailsRow[]>(() => [
    {
      labelKey: 'catalog.products.fields.title',
      value: this.product().title,
      valueType: 'text',
    },
    {
      labelKey: 'catalog.products.fields.reference',
      value: this.product().reference,
      valueType: 'text',
    },
    {
      labelKey: 'catalog.products.fields.vatRate',
      value: this.formattedVatRate(),
      valueType: 'text',
    },
    {
      labelKey: 'catalog.products.fields.price',
      value: this.formattedPrice(),
      valueType: 'price',
    },
    {
      labelKey: 'catalog.products.fields.type',
      value: this.typeLabel(),
      variant: this.typeVariant(),
      valueType: 'chip',
    },
    {
      labelKey: 'catalog.products.fields.createdAt',
      value: this.createdAt() ? this.datePipe.transform(this.createdAt(), 'medium') : null,
      valueType: 'text',
    },
    {
      labelKey: 'catalog.products.fields.updatedAt',
      value: this.updatedAt() ? this.datePipe.transform(this.updatedAt(), 'medium') : null,
      valueType: 'text',
    },
  ]);

  constructor(private readonly datePipe: DatePipe) {}
}
