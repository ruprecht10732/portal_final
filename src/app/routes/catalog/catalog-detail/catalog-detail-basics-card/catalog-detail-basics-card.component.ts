import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CatalogService, type Product, type UpdateProductRequest } from '../../../../core/services/catalog.service';
import { ChipComponent, type ChipVariant } from '../../../../shared/components/chip/chip.component';
import { LucideAngularModule } from 'lucide-angular';

interface DetailsRow {
  key: 'title' | 'reference' | 'vatRate' | 'price' | 'type' | 'createdAt' | 'updatedAt';
  labelKey: string;
  value: string | null;
  variant?: ChipVariant;
  valueType?: 'text' | 'price' | 'chip';
  editable?: boolean;
}

@Component({
  selector: 'app-catalog-detail-basics-card',
  imports: [DatePipe, TranslateModule, ChipComponent, LucideAngularModule],
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
  readonly updateProduct = input.required<(data: UpdateProductRequest) => Promise<void>>();

  private readonly datePipe = inject(DatePipe);
  protected readonly editingField = signal<DetailsRow['key'] | null>(null);
  protected readonly savingField = signal<DetailsRow['key'] | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editReference = signal('');
  protected readonly editPrice = signal('');

  protected readonly detailsRows = computed<DetailsRow[]>(() => [
    {
      key: 'title',
      labelKey: 'catalog.products.fields.title',
      value: this.product().title,
      valueType: 'text',
      editable: true,
    },
    {
      key: 'reference',
      labelKey: 'catalog.products.fields.reference',
      value: this.product().reference,
      valueType: 'text',
      editable: true,
    },
    {
      key: 'vatRate',
      labelKey: 'catalog.products.fields.vatRate',
      value: this.formattedVatRate(),
      valueType: 'text',
    },
    {
      key: 'price',
      labelKey: 'catalog.products.fields.price',
      value: this.formattedPrice(),
      valueType: 'price',
      editable: true,
    },
    {
      key: 'type',
      labelKey: 'catalog.products.fields.type',
      value: this.typeLabel(),
      variant: this.typeVariant(),
      valueType: 'chip',
    },
    {
      key: 'createdAt',
      labelKey: 'catalog.products.fields.createdAt',
      value: this.createdAt() ? this.datePipe.transform(this.createdAt(), 'medium') : null,
      valueType: 'text',
    },
    {
      key: 'updatedAt',
      labelKey: 'catalog.products.fields.updatedAt',
      value: this.updatedAt() ? this.datePipe.transform(this.updatedAt(), 'medium') : null,
      valueType: 'text',
    },
  ]);

  protected startEdit(key: DetailsRow['key']): void {
    if (this.savingField()) return;

    if (key === 'title') {
      this.editTitle.set(this.product().title ?? '');
    }
    if (key === 'reference') {
      this.editReference.set(this.product().reference ?? '');
    }
    if (key === 'price') {
      const price = CatalogService.centsToPrice(this.product().priceCents);
      this.editPrice.set(Number.isFinite(price) ? price.toFixed(2) : '');
    }

    this.editingField.set(key);
  }

  protected cancelEdit(): void {
    this.editingField.set(null);
  }

  protected async saveEdit(key: DetailsRow['key']): Promise<void> {
    if (this.savingField()) return;

    let payload: UpdateProductRequest | null = null;

    if (key === 'title') {
      const title = this.editTitle().trim();
      if (!title) return;
      payload = { title };
    }

    if (key === 'reference') {
      const reference = this.editReference().trim();
      if (!reference) return;
      payload = { reference };
    }

    if (key === 'price') {
      const value = Number.parseFloat(this.editPrice().replace(',', '.'));
      if (!Number.isFinite(value)) return;
      payload = { priceCents: CatalogService.priceToCents(value) };
    }

    if (!payload) return;

    this.savingField.set(key);
    try {
      await this.updateProduct()(payload);
      this.editingField.set(null);
    } finally {
      this.savingField.set(null);
    }
  }
}
