import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  CatalogService,
  type CatalogAsset,
  type CatalogAssetType,
  type Product,
  type ProductType,
  type UpdateProductRequest,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileUploaderComponent, type FileUploadError, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CatalogFormComponent, type CatalogFormValue } from '../catalog-form/catalog-form.component';

@Component({
  selector: 'app-catalog-edit',
  imports: [
    TranslateModule,
    ButtonComponent,
    ConfirmDialogComponent,
    FileUploaderComponent,
    PageHeaderComponent,
    CatalogFormComponent,
  ],
  templateUrl: './catalog-edit.component.html',
  styleUrl: './catalog-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogEditComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly activeTab = signal<'details' | 'materials' | 'assets'>('details');
  protected readonly selectedType = signal<ProductType>('product');

  protected readonly assets = signal<CatalogAsset[]>([]);
  protected readonly assetsLoading = signal(false);
  protected readonly assetsError = signal<string | null>(null);
  protected readonly imageUploading = signal(false);
  protected readonly documentUploading = signal(false);
  protected readonly termsUploading = signal(false);
  protected readonly assetUploading = computed(() =>
    this.imageUploading() || this.documentUploading() || this.termsUploading()
  );
  protected readonly assetDeletingId = signal<string | null>(null);
  protected readonly termsUrl = signal('');
  protected readonly termsLabel = signal('');

  // Materials management
  protected readonly materials = signal<Product[]>([]);
  protected readonly materialsLoading = signal(false);
  protected readonly availableMaterials = signal<Product[]>([]);
  protected readonly showAddMaterialDialog = signal(false);
  protected readonly selectedMaterialIds = signal<string[]>([]);
  protected readonly addingMaterials = signal(false);
  protected readonly removingMaterialId = signal<string | null>(null);

  /** True for service types that support billing periods */
  protected readonly isServiceType = computed(() => {
    const type = this.selectedType();
    return type === 'service' || type === 'digital_service';
  });

  /** Show materials tab based on current selected type (reactive to type changes) */
  protected readonly showMaterialsTab = computed(() => this.isServiceType());
  protected readonly showAssetsTab = computed(() => true);

  protected readonly formInitialValue = computed<CatalogFormValue | null>(() => {
    const product = this.product();
    if (!product) return null;
    return {
      title: product.title,
      reference: product.reference,
      description: product.description ?? '',
      price: CatalogService.centsToPrice(product.priceCents),
      vatRateId: product.vatRateId,
      type: product.type,
      periodCount: product.periodCount ?? null,
      periodUnit: product.periodUnit ?? null,
    };
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'materials') {
      this.activeTab.set('materials');
    } else if (tab === 'assets') {
      this.activeTab.set('assets');
    }
    if (id) {
      this.loadVatRates();
      this.loadProduct(id);
    }
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    this.catalogService.getProduct(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.selectedType.set(product.type);
        this.loading.set(false);
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

  private loadVatRates(): void {
    this.catalogService.listVatRates({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.vatRates.set(response.items);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadVatRates'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
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
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssets'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.assetsLoading.set(false);
      },
    });
  }

  protected handleTypeChange(value: ProductType): void {
    const wasServiceType = this.isServiceType();
    this.selectedType.set(value);

    const isNowServiceType = value === 'service' || value === 'digital_service';
    if (wasServiceType && !isNowServiceType) {
      this.activeTab.set('details');
    }

    const product = this.product();
    if (!wasServiceType && isNowServiceType && product) {
      this.loadMaterials(product.id);
    }
  }

  protected setActiveTab(tab: 'details' | 'materials' | 'assets'): void {
    this.activeTab.set(tab);
  }

  protected save(values: CatalogFormValue): void {
    const product = this.product();
    if (!product || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    const priceCents = values.price === null ? 0 : CatalogService.priceToCents(values.price);
    const descriptionValue = values.description.trim();
    const vatRateIdValue = values.vatRateId;

    const request: UpdateProductRequest = {
      title: values.title.trim(),
      reference: values.reference.trim(),
      priceCents,
      type: values.type,
      ...(descriptionValue && { description: descriptionValue }),
      ...(vatRateIdValue && { vatRateId: vatRateIdValue }),
    };

    // Add period fields only for service types
    if (values.type === 'service' || values.type === 'digital_service') {
      if (values.periodCount !== null) request.periodCount = values.periodCount;
      if (values.periodUnit !== null) request.periodUnit = values.periodUnit;
    }

    this.catalogService.updateProduct(product.id, request).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('catalog.products.updateSuccess'));
        this.router.navigate(['/app/catalog', product.id]);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.updateProduct'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected cancel(): void {
    const product = this.product();
    if (product) {
      this.router.navigate(['/app/catalog', product.id]);
    } else {
      this.router.navigate(['/app/catalog']);
    }
  }

  protected handleAssetUploaded(asset: CatalogAsset): void {
    this.assetsError.set(null);
    this.assets.update(items => [asset, ...items]);
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

  protected createTermsUrl(): void {
    const product = this.product();
    if (!product || this.assetUploading()) return;

    const url = this.termsUrl().trim();
    if (!url) return;

    const label = this.termsLabel().trim();
    this.termsUploading.set(true);
    this.assetsError.set(null);

    this.catalogService.createCatalogURLAsset(product.id, {
      assetType: 'terms_url',
      url,
      ...(label && { label }),
    }).subscribe({
      next: (created) => {
        this.assets.update(items => [created, ...items]);
        this.termsUrl.set('');
        this.termsLabel.set('');
        this.termsUploading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.createTerms'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.termsUploading.set(false);
      },
    });
  }

  protected deleteAsset(asset: CatalogAsset): void {
    const product = this.product();
    if (!product || this.assetDeletingId()) return;

    this.assetDeletingId.set(asset.id);
    this.assetsError.set(null);

    this.catalogService.deleteCatalogAsset(product.id, asset.id).subscribe({
      next: () => {
        this.assets.update(items => items.filter(item => item.id !== asset.id));
        this.assetDeletingId.set(null);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.deleteAsset'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.assetDeletingId.set(null);
      },
    });
  }

  protected openAsset(asset: CatalogAsset): void {
    const product = this.product();
    if (!product || this.assetUploading()) return;

    if (asset.assetType === 'terms_url' && asset.url) {
      window.open(asset.url, '_blank');
      return;
    }

    this.catalogService.getCatalogAssetDownloadUrl(product.id, asset.id).subscribe({
      next: (response) => {
        window.open(response.downloadUrl, '_blank');
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssetDownload'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected formatAssetLabel(asset: CatalogAsset): string {
    return asset.fileName || asset.url || this.translate.instant('catalog.products.assets.untitled');
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  protected getAssetTypeLabel(type: CatalogAssetType): string {
    return this.translate.instant(`catalog.products.assets.types.${type}`);
  }

  // Materials management methods
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
        // Filter out already linked materials
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
    this.selectedMaterialIds.update(ids => {
      if (ids.includes(materialId)) {
        return ids.filter(id => id !== materialId);
      }
      return [...ids, materialId];
    });
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

  protected removeMaterial(materialId: string): void {
    const product = this.product();
    if (!product) return;

    this.removingMaterialId.set(materialId);
    this.catalogService.removeProductMaterials(product.id, { materialIds: [materialId] }).subscribe({
      next: () => {
        this.materials.update(list => list.filter(m => m.id !== materialId));
        this.removingMaterialId.set(null);
        this.toast.success(this.translate.instant('catalog.products.materialRemoved'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.removeMaterial'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.removingMaterialId.set(null);
      },
    });
  }

  protected formatPrice(priceCents: number): string {
    return `€${CatalogService.centsToPrice(priceCents).toFixed(2)}`;
  }

}
