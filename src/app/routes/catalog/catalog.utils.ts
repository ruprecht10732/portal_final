import type { Product } from '../../core/services/catalog.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ErrorReportingService } from '../../core/services/error-reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { extractErrorMessage } from '../../core/utils/error-utils';
export { formatFileSize } from '../../core/utils/format-utils';


export function formatMaterialPrice(
  priceCents: number,
  unitPriceCents?: number,
  unitLabel?: string,
): string {
  if (unitLabel && typeof unitPriceCents === 'number' && unitPriceCents >= 0) {
    return `€${CatalogService.centsToPrice(unitPriceCents).toFixed(2)} / ${unitLabel}`;
  }
  if (priceCents >= 0) {
    return `€${CatalogService.centsToPrice(priceCents).toFixed(2)}`;
  }
  return '—';
}

export function formatMaterialPriceFromProduct(product: Product): string {
  return formatMaterialPrice(product.priceCents, product.unitPriceCents, product.unitLabel);
}

export function reportCatalogError(
  err: unknown,
  reporter: ErrorReportingService,
  translate: TranslateService,
  fallbackKey: string,
): string {
  const message = extractErrorMessage(err, translate.instant(fallbackKey));
  reporter.report(err, { source: 'http', silent: true, userMessage: message });
  return message;
}
