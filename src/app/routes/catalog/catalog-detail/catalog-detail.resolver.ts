import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { CatalogService, type Product, type VatRate } from '../../../core/services/catalog.service';

export interface CatalogDetailResolved {
  product: Product;
  vatRates: VatRate[];
  vatRate: VatRate | null;
}

export const catalogDetailResolver: ResolveFn<CatalogDetailResolved> = (route) => {
  const catalogService = inject(CatalogService);
  const productId = route.paramMap.get('id')!;

  return forkJoin({
    product: catalogService.getProduct(productId),
    vatRates: catalogService.listVatRates({ pageSize: 100 }).pipe(
      map(response => response.items ?? []),
    ),
  }).pipe(
    map(({ product, vatRates }) => {
      const vatRate = vatRates.find(v => v.id === product.vatRateId) ?? null;
      return { product, vatRates, vatRate };
    }),
  );
};
