import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { type CatalogAsset } from '../../../../core/services/catalog.service';
import { ChipComponent } from '../../../../shared/components/chip/chip.component';

interface AssetSection {
  key: 'images' | 'documents' | 'terms';
  titleKey: string;
  emptyKey: string;
  assets: CatalogAsset[];
  iconName: string;
  showThumbnail: boolean;
  showDownload: boolean;
  actionIcon: string;
  previewLabel: string;
  extensionFallback: string;
  subtitleMode: 'fileSize' | 'link';
  subtitleKey?: string;
  showUrl: boolean;
}

@Component({
  selector: 'app-catalog-detail-assets-card',
  imports: [TranslateModule, LucideAngularModule, ChipComponent],
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
  readonly previewAsset = input.required<(asset: CatalogAsset) => void>();
  readonly downloadAsset = input.required<(asset: CatalogAsset) => void>();

  protected readonly assetSections = computed<AssetSection[]>(() => [
    {
      key: 'images',
      titleKey: 'catalog.products.assets.images',
      emptyKey: 'catalog.products.assets.noImages',
      assets: this.imageAssets(),
      iconName: 'image',
      showThumbnail: true,
      showDownload: true,
      actionIcon: 'eye',
      previewLabel: 'Preview',
      extensionFallback: '—',
      subtitleMode: 'fileSize',
      showUrl: false,
    },
    {
      key: 'documents',
      titleKey: 'catalog.products.assets.documents',
      emptyKey: 'catalog.products.assets.noDocuments',
      assets: this.documentAssets(),
      iconName: 'file-text',
      showThumbnail: false,
      showDownload: true,
      actionIcon: 'eye',
      previewLabel: 'Preview',
      extensionFallback: '—',
      subtitleMode: 'fileSize',
      showUrl: false,
    },
    {
      key: 'terms',
      titleKey: 'catalog.products.assets.termsTitle',
      emptyKey: 'catalog.products.assets.noTerms',
      assets: this.termsAssets(),
      iconName: 'link-2',
      showThumbnail: false,
      showDownload: false,
      actionIcon: 'link-2',
      previewLabel: 'Open link',
      extensionFallback: 'LINK',
      subtitleMode: 'link',
      subtitleKey: 'catalog.products.assets.link',
      showUrl: true,
    },
  ]);

  protected getAssetLabel(asset: CatalogAsset): string {
    return asset.fileName || asset.fileKey || '';
  }

  protected getAssetExtension(asset: CatalogAsset): string {
    const name = asset.fileName || asset.fileKey;
    if (!name) return '';
    const parts = name.split('.');
    if (parts.length < 2) return '';
    const last = parts.at(-1);
    if (!last) return '';
    return last.toUpperCase();
  }
}
