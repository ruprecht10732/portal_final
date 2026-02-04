import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { type CatalogAsset } from '../../../../core/services/catalog.service';

@Component({
  selector: 'app-catalog-detail-assets-card',
  imports: [TranslateModule],
  templateUrl: './catalog-detail-assets-card.component.html',
  styleUrl: './catalog-detail-assets-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailAssetsCardComponent {
  readonly assetsCount = input.required<number>();
  readonly assetsError = input<string | null>(null);
  readonly assetsLoading = input.required<boolean>();
  readonly imageAssets = input.required<CatalogAsset[]>();
  readonly documentAssets = input.required<CatalogAsset[]>();
  readonly termsAssets = input.required<CatalogAsset[]>();
  readonly formatFileSize = input.required<(bytes?: number) => string>();
  readonly openAsset = input.required<(asset: CatalogAsset) => void>();
}
