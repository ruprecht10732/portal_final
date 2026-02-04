import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { type CatalogAsset } from '../../../../core/services/catalog.service';

@Component({
  selector: 'app-catalog-detail-assets-card',
  imports: [TranslateModule, LucideAngularModule],
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
  readonly imagePreviewUrls = input<Record<string, string>>({});
  readonly formatFileSize = input.required<(bytes?: number) => string>();
  readonly openAsset = input.required<(asset: CatalogAsset) => void>();

  protected getAssetLabel(asset: CatalogAsset): string {
    return asset.fileName || asset.fileKey || '';
  }

  protected getAssetExtension(asset: CatalogAsset): string {
    const name = asset.fileName || asset.fileKey;
    if (!name) return '';
    const parts = name.split('.');
    if (parts.length < 2) return '';
    const last = parts[parts.length - 1];
    if (!last) return '';
    return last.toUpperCase();
  }
}
