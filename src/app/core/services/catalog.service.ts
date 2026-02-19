import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';

// ============================================================================
// Interfaces
// ============================================================================

export interface VatRate {
  id: string;
  name: string;
  rateBps: number; // 2100 = 21%
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  vatRateId: string;
  title: string;
  reference: string;
  description?: string;
  priceCents: number; // 1050 = €10.50
  unitPriceCents: number; // 95000 = €950.00
  unitLabel?: string;
  laborTimeText?: string;
  type: ProductType;
  pricingMode?: MaterialPricingMode;
  periodCount?: number;
  periodUnit?: PeriodUnit;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductType = 'digital_service' | 'service' | 'product' | 'material';
export type PeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type MaterialPricingMode = 'included' | 'additional' | 'optional';
export type CatalogAssetType = 'image' | 'document' | 'terms_url';

export interface CatalogAsset {
  id: string;
  productId: string;
  assetType: CatalogAssetType;
  fileKey?: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  url?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ListVatRatesParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateVatRateRequest {
  name: string;
  rateBps: number;
}

export interface UpdateVatRateRequest {
  name?: string;
  rateBps?: number;
}

export interface ListProductsParams {
  search?: string;
  type?: ProductType;
  isDraft?: boolean;
  vatRateId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProductRequest {
  vatRateId: string;
  title: string;
  reference?: string;
  description?: string;
  priceCents: number;
  unitPriceCents?: number;
  unitLabel?: string;
  laborTimeText?: string;
  type: ProductType;
  periodCount?: number;
  periodUnit?: PeriodUnit;
  isDraft?: boolean;
}

export interface UpdateProductRequest {
  vatRateId?: string;
  title?: string;
  reference?: string;
  description?: string;
  priceCents?: number;
  unitPriceCents?: number;
  unitLabel?: string;
  laborTimeText?: string;
  type?: ProductType;
  periodCount?: number;
  periodUnit?: PeriodUnit;
  isDraft?: boolean;
}

export interface MaterialsRequest {
  materialIds?: string[];
  materials?: MaterialLinkInput[];
}

export interface MaterialLinkInput {
  materialId: string;
  pricingMode: MaterialPricingMode;
}

export interface PresignCatalogAssetRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  assetType: 'image' | 'document';
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: number;
}

export interface CreateCatalogAssetRequest {
  assetType: 'image' | 'document';
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CreateCatalogURLAssetRequest {
  assetType: 'terms_url';
  url: string;
  label?: string;
}

export interface CatalogAssetListResponse {
  items: CatalogAsset[];
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresAt?: number;
}

export interface NextProductReferenceResponse {
  reference: string;
}

// ============================================================================
// Autocomplete Types
// ============================================================================

export interface AutocompleteDocumentResponse {
  id: string;
  filename: string;
  fileKey: string;
}

export interface AutocompleteURLResponse {
  label: string;
  href: string;
}

export interface AutocompleteItemResponse {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  unitPriceCents: number;
  unitLabel: string;
  vatRateId: string;
  vatRateBps: number;
  documents: AutocompleteDocumentResponse[];
  urls: AutocompleteURLResponse[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/catalog`;
  private readonly adminBaseUrl = `${environment.apiBaseUrl}/admin/catalog`;

  // ==========================================================================
  // Helper Methods - Static conversion utilities
  // ==========================================================================

  /** Convert display price (e.g., 10.50) to API cents (e.g., 1050) */
  static priceToCents(price: number): number {
    return Math.round(price * 100);
  }

  /** Convert display rate (e.g., 21) to API basis points (e.g., 2100) */
  static rateToBps(rate: number): number {
    return Math.round(rate * 100);
  }

  /** Convert API cents (e.g., 1050) to display price (e.g., 10.50) */
  static centsToPrice(cents: number): number {
    return cents / 100;
  }

  /** Convert API basis points (e.g., 2100) to display rate (e.g., 21) */
  static bpsToRate(bps: number): number {
    return bps / 100;
  }

  // ==========================================================================
  // VAT Rates
  // ==========================================================================

  listVatRates(params: ListVatRatesParams = {}): Observable<PaginatedResponse<VatRate>> {
    return this.http.get<PaginatedResponse<VatRate>>(`${this.baseUrl}/vat-rates`, {
      params: this.buildVatRatesParams(params),
    });
  }

  getVatRate(id: string): Observable<VatRate> {
    return this.http.get<VatRate>(`${this.baseUrl}/vat-rates/${id}`);
  }

  createVatRate(data: CreateVatRateRequest): Observable<VatRate> {
    return this.http.post<VatRate>(`${this.adminBaseUrl}/vat-rates`, data);
  }

  updateVatRate(id: string, data: UpdateVatRateRequest): Observable<VatRate> {
    return this.http.put<VatRate>(`${this.adminBaseUrl}/vat-rates/${id}`, data);
  }

  deleteVatRate(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.adminBaseUrl}/vat-rates/${id}`);
  }

  // ==========================================================================
  // Products
  // ==========================================================================

  listProducts(params: ListProductsParams = {}): Observable<PaginatedResponse<Product>> {
    return this.http.get<PaginatedResponse<Product>>(`${this.baseUrl}/products`, {
      params: this.buildProductsParams(params),
    });
  }

  /** Search for products with autocomplete metadata (documents, urls, vatRateBps). */
  searchForAutocomplete(query: string, limit = 5): Observable<AutocompleteItemResponse[]> {
    return this.http.get<AutocompleteItemResponse[]>(`${this.baseUrl}/products/search`, {
      params: toHttpParams({ q: query, limit }),
    });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  getNextProductReference(): Observable<NextProductReferenceResponse> {
    return this.http.get<NextProductReferenceResponse>(`${this.adminBaseUrl}/products/next-reference`);
  }

  createProduct(data: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(`${this.adminBaseUrl}/products`, data);
  }

  updateProduct(id: string, data: UpdateProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.adminBaseUrl}/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.adminBaseUrl}/products/${id}`);
  }

  // ==========================================================================
  // Materials (Product associations)
  // ==========================================================================

  listProductMaterials(productId: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/products/${productId}/materials`);
  }


  // ========================================================================
  // Assets
  // ========================================================================

  listProductAssets(productId: string, type?: CatalogAssetType): Observable<CatalogAssetListResponse> {
    const params = type ? toHttpParams({ type }) : undefined;
    return this.http.get<CatalogAssetListResponse>(`${this.baseUrl}/products/${productId}/assets`, {
      ...(params !== undefined && { params }),
    });
  }

  getCatalogAssetDownloadUrl(productId: string, assetId: string): Observable<PresignedDownloadResponse> {
    return this.http.get<PresignedDownloadResponse>(`${this.baseUrl}/products/${productId}/assets/${assetId}/download`);
  }

  getCatalogAssetPresign(productId: string, data: PresignCatalogAssetRequest): Observable<PresignedUploadResponse> {
    return this.http.post<PresignedUploadResponse>(`${this.adminBaseUrl}/products/${productId}/assets/presign`, data);
  }

  createCatalogAsset(productId: string, data: CreateCatalogAssetRequest): Observable<CatalogAsset> {
    return this.http.post<CatalogAsset>(`${this.adminBaseUrl}/products/${productId}/assets`, data);
  }

  createCatalogURLAsset(productId: string, data: CreateCatalogURLAssetRequest): Observable<CatalogAsset> {
    return this.http.post<CatalogAsset>(`${this.adminBaseUrl}/products/${productId}/assets/url`, data);
  }

  deleteCatalogAsset(productId: string, assetId: string): Observable<void> {
    return this.http.delete<void>(`${this.adminBaseUrl}/products/${productId}/assets/${assetId}`);
  }
  addProductMaterials(productId: string, data: MaterialsRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.adminBaseUrl}/products/${productId}/materials`, data);
  }

  removeProductMaterials(productId: string, data: MaterialsRequest): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.adminBaseUrl}/products/${productId}/materials`, {
      body: data,
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private buildVatRatesParams(params: ListVatRatesParams) {
    const entries: Record<string, string | number | undefined | null> = {
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    return toHttpParams(entries);
  }

  private buildProductsParams(params: ListProductsParams) {
    const entries: Record<string, string | number | boolean | undefined | null> = {
      search: params.search,
      type: params.type,
      isDraft: params.isDraft,
      vatRateId: params.vatRateId,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    return toHttpParams(entries);
  }
}
