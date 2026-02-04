import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { type Product } from '../../../../core/services/catalog.service';
import { ChipComponent } from '../../../../shared/components/chip/chip.component';

@Component({
  selector: 'app-catalog-detail-materials-card',
  imports: [TranslateModule, ChipComponent],
  templateUrl: './catalog-detail-materials-card.component.html',
  styleUrl: './catalog-detail-materials-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailMaterialsCardComponent {
  readonly materials = input.required<Product[]>();
  readonly materialsLoading = input.required<boolean>();
  readonly formatMaterialPrice = input.required<(priceCents: number) => string>();
}
