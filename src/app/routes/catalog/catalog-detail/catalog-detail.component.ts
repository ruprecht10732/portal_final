import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import {
  CatalogService,
  type CatalogAsset,
  type Product,
  type ProductType,
  type UpdateProductRequest,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { type ChipVariant } from '../../../shared/components/chip/chip.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  type FileUploadError,
  type PresignedUpload,
} from '../../../shared/components/file-uploader/file-uploader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FilePreviewDialogComponent } from '../../../shared/components/file-preview-dialog/file-preview-dialog.component';
import { CatalogDetailAssetsCardComponent } from './catalog-detail-assets-card/catalog-detail-assets-card.component';
import { CatalogDetailBasicsCardComponent } from './catalog-detail-basics-card/catalog-detail-basics-card.component';
import { CatalogDetailMaterialsCardComponent } from './catalog-detail-materials-card/catalog-detail-materials-card.component';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
    PageHeaderComponent,
    FilePreviewDialogComponent,
    CatalogDetailAssetsCardComponent,
    CatalogDetailBasicsCardComponent,
    CatalogDetailMaterialsCardComponent,
  ],
  templateUrl: './catalog-detail.component.html',
  styleUrl: './catalog-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly product = signal<Product | null>(null);
  protected readonly vatRate = signal<VatRate | null>(null);
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly showDeleteDialog = signal(false);

  protected readonly assets = signal<CatalogAsset[]>([]);
  protected readonly assetsLoading = signal(false);
  protected readonly assetsError = signal<string | null>(null);
  protected readonly downloadingAssetId = signal<string | null>(null);
  protected readonly heroImageUrl = signal<string | null>(null);
  protected readonly imagePreviewUrls = signal<Record<string, string>>({});
  protected readonly previewOpen = signal(false);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly previewAsset = signal<CatalogAsset | null>(null);
  protected readonly showDeleteAssetDialog = signal(false);
  protected readonly deleteAssetCandidate = signal<CatalogAsset | null>(null);

  // Materials for service products
  protected readonly materials = signal<Product[]>([]);
  protected readonly materialsLoading = signal(false);
  protected readonly availableMaterials = signal<Product[]>([]);
  protected readonly selectedMaterialIds = signal<string[]>([]);
  protected readonly showAddMaterialDialog = signal(false);
  protected readonly addingMaterials = signal(false);
  protected readonly selectedMaterialCount = computed(() => this.selectedMaterialIds().length);

  protected readonly formattedPrice = computed(() => {
    const product = this.product();
    if (!product) return '—';
    return `€${CatalogService.centsToPrice(product.priceCents).toFixed(2)}`;
  });

  protected readonly formattedVatRate = computed(() => {
    const vr = this.vatRate();
    if (!vr) return '—';
    return `${vr.name} (${CatalogService.bpsToRate(vr.rateBps)}%)`;
  });

  protected readonly typeOptions = computed(() => [
    { value: 'service' as ProductType, label: this.translate.instant('catalog.products.types.service') },
    { value: 'digital_service' as ProductType, label: this.translate.instant('catalog.products.types.digital_service') },
    { value: 'product' as ProductType, label: this.translate.instant('catalog.products.types.product') },
    { value: 'material' as ProductType, label: this.translate.instant('catalog.products.types.material') },
  ]);

  protected readonly formattedPeriod = computed(() => {
    const product = this.product();
    if (!product?.periodCount || !product.periodUnit) return null;
    const unitKey = `catalog.products.periodUnits.${product.periodUnit}`;
    const unitLabel = this.translate.instant(unitKey);
    return `${product.periodCount} ${unitLabel}`;
  });

  protected readonly typeLabel = computed(() => {
    const product = this.product();
    if (!product) return '—';
    return this.translate.instant(`catalog.products.types.${product.type}`);
  });

  protected readonly showMaterials = computed(() => {
    const product = this.product();
    return product?.type === 'service' || product?.type === 'digital_service';
  });

  protected readonly imageAssets = computed(() => this.assets().filter(asset => asset.assetType === 'image'));
  protected readonly documentAssets = computed(() => this.assets().filter(asset => asset.assetType === 'document'));
  protected readonly termsAssets = computed(() => this.assets().filter(asset => asset.assetType === 'terms_url'));
  protected readonly heroImages = computed(() =>
    this.imageAssets()
      .map(asset => ({
        id: asset.id,
        url: this.imagePreviewUrls()[asset.id] || '',
        label: asset.fileName || asset.fileKey || 'Image',
      }))
      .filter(image => Boolean(image.url)),
  );

  protected readonly onOpenAsset = (asset: CatalogAsset): void => this.openAsset(asset);
  protected readonly onPreviewAsset = (asset: CatalogAsset): void => this.openPreview(asset);
  protected readonly onDownloadAsset = (asset: CatalogAsset): void => this.openAsset(asset);
  protected readonly onFormatFileSize = (bytes?: number): string => this.formatFileSize(bytes);
  protected readonly onFormatMaterialPrice = (priceCents: number): string => this.formatMaterialPrice(priceCents);
  protected readonly onAssetUploaded = (asset: CatalogAsset): void => this.handleAssetUploaded(asset);
  protected readonly onAssetError = (event: FileUploadError | null): void => this.handleAssetError(event);
  protected readonly onDeleteAsset = (asset: CatalogAsset): void => this.requestDeleteAsset(asset);
  protected readonly onCreateTermsUrl = async (url: string, label?: string): Promise<CatalogAsset | null> =>
    this.createTermsUrl(url, label);
  protected readonly onUpdateProduct = async (data: UpdateProductRequest): Promise<void> =>
    this.updateProduct(data);
  protected readonly onVatRateChange = async (vatRateId: string): Promise<void> =>
    this.updateVatRate(vatRateId);
  protected readonly onTypeChange = async (type: ProductType): Promise<void> =>
    this.updateProduct({ type });
  protected readonly onOpenAddMaterialDialog = (): void => this.openAddMaterialDialog();
  protected readonly onSelectHeroImage = (url: string): void => this.heroImageUrl.set(url);
  protected readonly onPreviewHeroImage = (assetId: string): void => this.previewHeroImage(assetId);
  protected readonly onDeleteHeroImage = (assetId: string): void => this.requestDeleteHeroImage(assetId);

  protected readonly previewTitle = computed(() => {
    const asset = this.previewAsset();
    return asset?.fileName || asset?.fileKey || asset?.url || 'File preview';
  });

  protected readonly previewFileName = computed(() => {
    const asset = this.previewAsset();
    return asset?.fileName || asset?.fileKey || '';
  });

  protected readonly previewContentType = computed(() => this.previewAsset()?.contentType || null);

  protected readonly deleteAssetTitleKey = computed(() =>
    this.getDeleteAssetCopyKey('title', this.deleteAssetCandidate()?.assetType),
  );

  protected readonly deleteAssetMessageKey = computed(() =>
    this.getDeleteAssetCopyKey('message', this.deleteAssetCandidate()?.assetType),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadProduct(id);
    }
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    this.catalogService.getProduct(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
        this.loadVatRate(product.vatRateId);
        this.loadAssets(product.id);
        if (product.type === 'service' || product.type === 'digital_service') {
          this.loadMaterials(id);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadVatRate(vatRateId: string): void {
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items ?? []);
        const vr = response.items.find(v => v.id === vatRateId);
        if (vr) {
          this.vatRate.set(vr);
        }
      },
      error: () => {
        // Silent fail for VAT rate
      },
    });
  }

  private loadMaterials(productId: string): void {
    this.materialsLoading.set(true);
    this.catalogService.listProductMaterials(productId).subscribe({
      next: (materials) => {
        this.materials.set(materials);
        this.materialsLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.materialsLoading.set(false);
      },
    });
  }

  private loadAssets(productId: string): void {
    this.assetsLoading.set(true);
    this.assetsError.set(null);
    this.catalogService.listProductAssets(productId).subscribe({
      next: (response) => {
        this.assets.set(response.items);
        this.assetsLoading.set(false);
        this.loadHeroImage(productId, response.items);
        this.loadImagePreviews(productId, response.items);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssets'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.assetsLoading.set(false);
      },
    });
  }

  private loadImagePreviews(productId: string, assets: CatalogAsset[]): void {
    const images = assets.filter(asset => asset.assetType === 'image');
    if (images.length === 0) {
      this.imagePreviewUrls.set({});
      return;
    }

    this.imagePreviewUrls.set({});
    images.forEach((asset) => {
      this.catalogService.getCatalogAssetDownloadUrl(productId, asset.id).subscribe({
        next: (response) => {
          this.imagePreviewUrls.update(current => ({ ...current, [asset.id]: response.downloadUrl }));
        },
        error: () => {
          // Preview is optional; fail silently.
        },
      });
    });
  }

  private loadHeroImage(productId: string, assets: CatalogAsset[]): void {
    const imageAsset = assets.find(asset => asset.assetType === 'image');
    if (!imageAsset) {
      this.heroImageUrl.set(null);
      return;
    }

    this.catalogService.getCatalogAssetDownloadUrl(productId, imageAsset.id).subscribe({
      next: (response) => {
        this.heroImageUrl.set(response.downloadUrl);
      },
      error: () => {
        this.heroImageUrl.set(null);
      },
    });
  }

  protected edit(): void {
    const product = this.product();
    if (product) {
      this.router.navigate(['/app/catalog', product.id, 'edit']);
    }
  }

  protected goBack(): void {
    this.router.navigate(['/app/catalog']);
  }

  protected openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  protected confirmDelete(): void {
    const product = this.product();
    if (!product || this.deleting()) return;

    this.deleting.set(true);
    this.catalogService.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('catalog.products.deleteSuccess'));
        this.router.navigate(['/app/catalog']);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.deleteProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  protected formatMaterialPrice(priceCents: number): string {
    return `€${CatalogService.centsToPrice(priceCents).toFixed(2)}`;
  }

  protected openAsset(asset: CatalogAsset): void {
    const product = this.product();
    if (!product || this.downloadingAssetId()) return;

    if (asset.assetType === 'terms_url' && asset.url) {
      window.open(asset.url, '_blank');
      return;
    }

    this.downloadingAssetId.set(asset.id);
    this.catalogService.getCatalogAssetDownloadUrl(product.id, asset.id).subscribe({
      next: (response) => {
        window.open(response.downloadUrl, '_blank');
        this.downloadingAssetId.set(null);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssetDownload'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.downloadingAssetId.set(null);
      },
    });
  }

  protected openPreview(asset: CatalogAsset): void {
    const product = this.product();
    if (!product) return;

    if (asset.assetType === 'terms_url' && asset.url) {
      window.open(asset.url, '_blank');
      return;
    }

    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewUrl.set(null);
    this.previewAsset.set(asset);

    this.catalogService.getCatalogAssetDownloadUrl(product.id, asset.id).subscribe({
      next: (response) => {
        this.previewUrl.set(response.downloadUrl);
        this.previewLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssetDownload'));
        this.previewError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.previewLoading.set(false);
      },
    });
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewUrl.set(null);
    this.previewAsset.set(null);
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  protected getTypeVariant(type: ProductType): ChipVariant {
    switch (type) {
      case 'service':
        return 'info';
      case 'digital_service':
        return 'warning';
      case 'product':
        return 'success';
      case 'material':
        return 'neutral';
      default:
        return 'default';
    }
  }

  private async updateVatRate(vatRateId: string): Promise<void> {
    await this.updateProduct({ vatRateId });
    const selected = this.vatRates().find(v => v.id === vatRateId) || null;
    this.vatRate.set(selected);
  }

  private previewHeroImage(assetId: string): void {
    const asset = this.assets().find(item => item.id === assetId);
    if (asset) {
      this.openPreview(asset);
    }
  }

  private requestDeleteHeroImage(assetId: string): void {
    const asset = this.assets().find(item => item.id === assetId);
    if (asset) {
      this.requestDeleteAsset(asset);
    }
  }

  protected requestDeleteAsset(asset: CatalogAsset): void {
    this.deleteAssetCandidate.set(asset);
    this.showDeleteAssetDialog.set(true);
  }

  protected closeDeleteAssetDialog(): void {
    this.showDeleteAssetDialog.set(false);
    this.deleteAssetCandidate.set(null);
  }

  protected confirmDeleteAsset(): void {
    const asset = this.deleteAssetCandidate();
    if (!asset) return;

    this.showDeleteAssetDialog.set(false);
    this.deleteAssetCandidate.set(null);
    this.deleteAssetById(asset.id);
  }

  private getDeleteAssetCopyKey(
    target: 'title' | 'message',
    type?: CatalogAsset['assetType'],
  ): string {
    switch (type) {
      case 'document':
        return `catalog.assets.deleteAsset${target === 'title' ? 'Title' : 'Message'}Document`;
      case 'terms_url':
        return `catalog.assets.deleteAsset${target === 'title' ? 'Title' : 'Message'}Url`;
      case 'image':
      default:
        return `catalog.assets.deleteAsset${target === 'title' ? 'Title' : 'Message'}Image`;
    }
  }

  private deleteAssetById(assetId: string): void {
    const product = this.product();
    if (!product) return;

    this.assetsError.set(null);
    this.catalogService.deleteCatalogAsset(product.id, assetId).subscribe({
      next: () => {
        this.assets.update(items => items.filter(item => item.id !== assetId));
        this.imagePreviewUrls.update(current => {
          const next = { ...current };
          delete next[assetId];
          return next;
        });
        if (this.heroImageUrl()) {
          const nextHero = this.imageAssets()
            .map(asset => this.imagePreviewUrls()[asset.id])
            .find(Boolean);
          this.heroImageUrl.set(nextHero || null);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.deleteAsset'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }


  private async updateProduct(data: UpdateProductRequest): Promise<void> {
    const product = this.product();
    if (!product) return;

    try {
      this.error.set(null);
      const updated = await firstValueFrom(this.catalogService.updateProduct(product.id, data));
      this.product.set(updated);
      this.toast.success(this.translate.instant('catalog.products.updateSuccess'));
    } catch (err) {
      const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.updateProduct'));
      this.error.set(message);
      this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
    }
  }
  protected handleAssetUploaded(asset: CatalogAsset): void {
    const product = this.product();
    if (!product) return;

    this.assetsError.set(null);
    this.assets.update(items => [asset, ...items]);

    if (asset.assetType === 'image') {
      this.catalogService.getCatalogAssetDownloadUrl(product.id, asset.id).subscribe({
        next: (response) => {
          this.imagePreviewUrls.update(current => ({ ...current, [asset.id]: response.downloadUrl }));
          if (!this.heroImageUrl()) {
            this.heroImageUrl.set(response.downloadUrl);
          }
        },
        error: () => {
          // Preview is optional; fail silently.
        },
      });
    }
  }

  protected handleAssetError(event: FileUploadError | null): void {
    if (!event) {
      this.assetsError.set(null);
      return;
    }
    this.assetsError.set(event.message);
    this.reporter.report(event.error, { source: 'http', silent: true, userMessage: event.message });
  }

  protected readonly presignImageAsset = async (file: File): Promise<PresignedUpload> => {
    const product = this.product();
    if (!product) throw new Error('Missing product');
    return firstValueFrom(this.catalogService.getCatalogAssetPresign(product.id, {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      assetType: 'image',
    }));
  };

  protected readonly presignDocumentAsset = async (file: File): Promise<PresignedUpload> => {
    const product = this.product();
    if (!product) throw new Error('Missing product');
    return firstValueFrom(this.catalogService.getCatalogAssetPresign(product.id, {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      assetType: 'document',
    }));
  };

  protected readonly finalizeImageAsset = async (file: File, presigned: PresignedUpload): Promise<CatalogAsset> => {
    const product = this.product();
    if (!product) throw new Error('Missing product');
    return firstValueFrom(this.catalogService.createCatalogAsset(product.id, {
      assetType: 'image',
      fileKey: presigned.fileKey,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }));
  };

  protected readonly finalizeDocumentAsset = async (file: File, presigned: PresignedUpload): Promise<CatalogAsset> => {
    const product = this.product();
    if (!product) throw new Error('Missing product');
    return firstValueFrom(this.catalogService.createCatalogAsset(product.id, {
      assetType: 'document',
      fileKey: presigned.fileKey,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }));
  };

  protected async createTermsUrl(url: string, label?: string): Promise<CatalogAsset | null> {
    const product = this.product();
    if (!product) return null;

    try {
      this.assetsError.set(null);
      return await firstValueFrom(this.catalogService.createCatalogURLAsset(product.id, {
        assetType: 'terms_url',
        url,
        ...(label && { label }),
      }));
    } catch (err) {
      const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.createTerms'));
      this.assetsError.set(message);
      this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      return null;
    }
  }

  protected openAddMaterialDialog(): void {
    this.selectedMaterialIds.set([]);
    this.loadAvailableMaterials();
    this.showAddMaterialDialog.set(true);
  }

  protected closeAddMaterialDialog(): void {
    this.showAddMaterialDialog.set(false);
    this.selectedMaterialIds.set([]);
  }

  private loadAvailableMaterials(): void {
    this.catalogService.listProducts({ type: 'material', pageSize: 100 }).subscribe({
      next: (response) => {
        const linkedIds = new Set(this.materials().map(m => m.id));
        this.availableMaterials.set(response.items.filter(m => !linkedIds.has(m.id)));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected toggleMaterialSelection(materialId: string): void {
    this.selectedMaterialIds.update(ids =>
      ids.includes(materialId) ? ids.filter(id => id !== materialId) : [...ids, materialId],
    );
  }

  protected isMaterialSelected(materialId: string): boolean {
    return this.selectedMaterialIds().includes(materialId);
  }

  protected addSelectedMaterials(): void {
    const product = this.product();
    const ids = this.selectedMaterialIds();
    if (!product || ids.length === 0) return;

    this.addingMaterials.set(true);
    this.catalogService.addProductMaterials(product.id, { materialIds: ids }).subscribe({
      next: () => {
        this.closeAddMaterialDialog();
        this.loadMaterials(product.id);
        this.addingMaterials.set(false);
        this.toast.success(this.translate.instant('catalog.products.materialsAdded'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.addMaterials'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.addingMaterials.set(false);
      },
    });
  }

}
