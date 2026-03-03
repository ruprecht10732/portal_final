import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { type Product } from '../../../../core/services/catalog.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ChipComponent } from '../../../../shared/components/chip/chip.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-catalog-detail-materials-card',
  imports: [TranslateModule, ButtonComponent, ChipComponent, LucideAngularModule],
  templateUrl: './catalog-detail-materials-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailMaterialsCardComponent {
  readonly materials = input.required<Product[]>();
  readonly materialsLoading = input.required<boolean>();
  readonly formatMaterialPrice = input.required<(product: Product) => string>();
  readonly openAddMaterialDialog = input.required<() => void>();
}
