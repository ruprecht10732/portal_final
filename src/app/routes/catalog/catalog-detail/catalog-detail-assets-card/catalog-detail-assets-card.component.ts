import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { type CatalogAsset } from '../../../../core/services/catalog.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { ChipComponent } from '../../../../shared/components/chip/chip.component';
import {
  FileUploaderComponent,
  type FileUploadError,
  type PresignedUpload,
} from '../../../../shared/components/file-uploader/file-uploader.component';

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
  countSingularKey: string;
  countPluralKey: string;
  addLabelKey: string;
}

@Component({
  selector: 'app-catalog-detail-assets-card',
  imports: [
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ChipComponent,
    FileUploaderComponent,
  ],
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
  readonly presignImageAsset = input.required<(file: File) => Promise<PresignedUpload>>();
  readonly finalizeImageAsset = input.required<
    (file: File, presigned: PresignedUpload) => Promise<CatalogAsset>
  >();
  readonly presignDocumentAsset = input.required<(file: File) => Promise<PresignedUpload>>();
  readonly finalizeDocumentAsset = input.required<
    (file: File, presigned: PresignedUpload) => Promise<CatalogAsset>
  >();
  readonly createTermsUrl = input.required<
    (url: string, label?: string) => Promise<CatalogAsset | null>
  >();
  readonly onAssetUploaded = input.required<(asset: CatalogAsset) => void>();
  readonly onAssetError = input.required<(event: FileUploadError | null) => void>();

  protected readonly addOpen = signal<AssetSection['key'] | null>(null);
  protected readonly imageUploading = signal(false);
  protected readonly documentUploading = signal(false);
  protected readonly termsSubmitting = signal(false);
  protected readonly termsUrl = signal('');
  protected readonly termsLabel = signal('');

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
      countSingularKey: 'catalog.products.assets.countFile',
      countPluralKey: 'catalog.products.assets.countFiles',
      addLabelKey: 'catalog.products.assets.uploadImage',
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
      countSingularKey: 'catalog.products.assets.countFile',
      countPluralKey: 'catalog.products.assets.countFiles',
      addLabelKey: 'catalog.products.assets.uploadDocument',
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
      countSingularKey: 'catalog.products.assets.countUrl',
      countPluralKey: 'catalog.products.assets.countUrls',
      addLabelKey: 'catalog.products.assets.addTerms',
    },
  ]);

  protected toggleAddSection(key: AssetSection['key']): void {
    this.addOpen.update(current => (current === key ? null : key));
  }

  protected handleUploaded(asset: CatalogAsset): void {
    this.addOpen.set(null);
    this.onAssetUploaded()(asset);
  }

  protected async submitTermsUrl(): Promise<void> {
    if (this.termsSubmitting()) return;

    const url = this.termsUrl().trim();
    if (!url) return;

    const label = this.termsLabel().trim();
    this.termsSubmitting.set(true);

    try {
      const created = await this.createTermsUrl()(url, label || undefined);
      if (created) {
        this.termsUrl.set('');
        this.termsLabel.set('');
        this.handleUploaded(created);
      }
    } finally {
      this.termsSubmitting.set(false);
    }
  }

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

  protected getCountKey(section: AssetSection, count: number): string {
    return count === 1 ? section.countSingularKey : section.countPluralKey;
  }
}
