import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { type Product } from '../../../../core/services/catalog.service';
import { ChipComponent, type ChipVariant } from '../../../../shared/components/chip/chip.component';

@Component({
  selector: 'app-catalog-detail-basics-card',
  imports: [DatePipe, TranslateModule, ChipComponent],
  templateUrl: './catalog-detail-basics-card.component.html',
  styleUrl: './catalog-detail-basics-card.component.css',
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
}
