import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  CatalogService,
  type CatalogAsset,
  type Product,
  type ProductType,
  type VatRate,
} from '../../../core/services/catalog.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { type ChipVariant } from '../../../shared/components/chip/chip.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CatalogDetailAssetsCardComponent } from './catalog-detail-assets-card/catalog-detail-assets-card.component';
import { CatalogDetailBasicsCardComponent } from './catalog-detail-basics-card/catalog-detail-basics-card.component';
import { CatalogDetailMaterialsCardComponent } from './catalog-detail-materials-card/catalog-detail-materials-card.component';
import { CatalogDetailMetaCardComponent } from './catalog-detail-meta-card/catalog-detail-meta-card.component';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
    PageHeaderComponent,
    CatalogDetailAssetsCardComponent,
    CatalogDetailBasicsCardComponent,
    CatalogDetailMaterialsCardComponent,
    CatalogDetailMetaCardComponent,
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
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly showDeleteDialog = signal(false);

  protected readonly assets = signal<CatalogAsset[]>([]);
  protected readonly assetsLoading = signal(false);
  protected readonly assetsError = signal<string | null>(null);
  protected readonly downloadingAssetId = signal<string | null>(null);
  protected readonly heroImageUrl = signal<string | null>(null);

  // Materials for service products
  protected readonly materials = signal<Product[]>([]);
  protected readonly materialsLoading = signal(false);

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

  protected readonly onOpenAsset = (asset: CatalogAsset): void => this.openAsset(asset);
  protected readonly onFormatFileSize = (bytes?: number): string => this.formatFileSize(bytes);
  protected readonly onFormatMaterialPrice = (priceCents: number): string => this.formatMaterialPrice(priceCents);

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
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('catalog.products.errors.loadAssets'));
        this.assetsError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.assetsLoading.set(false);
      },
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

}
