// Quote types — aligned with backend API (cents-based)


// Backend uses PascalCase enum values
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export type DiscountType = 'percentage' | 'fixed';

/**
 * Tax rate in basis points. 2100 = 21%, 900 = 9%, 0 = 0%.
 * The backend stores and returns BPS; the frontend converts for display.
 */

/** Legacy display-friendly rate (0 | 9 | 21). Used only in the UI. */
export type TaxRateDisplay = 0 | 9 | 21;

export type PricingMode = 'exclusive' | 'inclusive';

// ── API Response types (from backend) ─────────────────────────────────────────

export interface QuoteItemResponse {
  id: string;
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  isOptional: boolean;
  isSelected: boolean;
  sortOrder: number;
  totalBeforeTaxCents: number;
  totalTaxCents: number;
  lineTotalCents: number;
  annotations: AnnotationResponse[];
}

export interface VatBreakdown {
  rateBps: number;
  amountCents: number;
}

export interface QuoteResponse {
  id: string;
  quoteNumber: string;
  leadId: string;
  leadServiceId?: string;
  createdById?: string;
  createdByFirstName?: string;
  createdByLastName?: string;
  createdByEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddressStreet?: string;
  customerAddressHouseNumber?: string;
  customerAddressZipCode?: string;
  customerAddressCity?: string;
  status: QuoteStatus;
  pricingMode: PricingMode;
  discountType: DiscountType;
  discountValue: number; // percentage int or cents
  subtotalCents: number;
  discountAmountCents: number;
  taxTotalCents: number;
  totalCents: number;
  validUntil?: string;
  notes?: string;
  items: QuoteItemResponse[];
  pdfFileKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteListResponse {
  items: QuoteResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QuotePreviewLinkResponse {
  token: string;
  expiresAt?: string;
}

export interface CalculatedLineItem {
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  isOptional: boolean;
  totalBeforeTaxCents: number;
  totalTaxCents: number;
  lineTotalCents: number;
}

export interface QuoteCalculationResponse {
  lines: CalculatedLineItem[];
  subtotalCents: number;
  discountAmountCents: number;
  vatTotalCents: number;
  vatBreakdown: VatBreakdown[];
  totalCents: number;
}

// ── API Request types ─────────────────────────────────────────────────────────

export interface QuoteItemRequest {
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  isOptional: boolean;
}

export interface CreateQuoteRequest {
  leadId: string;
  leadServiceId?: string;
  pricingMode?: PricingMode;
  discountType?: DiscountType;
  discountValue?: number;
  validUntil?: string;
  notes?: string;
  items: QuoteItemRequest[];
}

export interface UpdateQuoteRequest {
  pricingMode?: PricingMode;
  discountType?: DiscountType;
  discountValue?: number;
  validUntil?: string;
  notes?: string;
  items?: QuoteItemRequest[];
}

export interface QuoteCalculationRequest {
  items: QuoteItemRequest[];
  pricingMode?: PricingMode;
  discountType?: DiscountType;
  discountValue?: number;
}

// ── Enriched frontend type (quote + lead info) ────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse numeric value from free-form quantity string.
 * Examples: "5 x" -> 5, "10 m²" -> 10, "3.5 uur" -> 3.5
 */
export function parseQuantityNumber(quantity: string): number {
  const match = /^([\d.,]+)/.exec(quantity);
  if (!match?.[1]) return 1;
  return Number.parseFloat(match[1].replace(',', '.')) || 1;
}

/** Convert a display tax rate (21) to basis points (2100). */
export function taxDisplayToBps(rate: TaxRateDisplay): number {
  return rate * 100;
}

/** Convert basis points (2100) to a display rate (21). */
export function taxBpsToDisplay(bps: number): TaxRateDisplay {
  return (bps / 100) as TaxRateDisplay;
}

/** Convert euros to cents. */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Convert cents to euros. */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

export function formatQuoteCustomerName(quote: QuoteResponse): string {
  const first = quote.customerFirstName ?? '';
  const last = quote.customerLastName ?? '';
  return `${first} ${last}`.trim();
}

export function formatQuoteCreatedBy(quote: QuoteResponse): string {
  const first = quote.createdByFirstName ?? '';
  const last = quote.createdByLastName ?? '';
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  return quote.createdByEmail ?? '';
}

// Status display helpers — keys match backend PascalCase enum
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  Draft: 'Draft',
  Sent: 'Sent',
  Accepted: 'Accepted',
  Rejected: 'Rejected',
  Expired: 'Expired',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  Draft: 'bg-zinc-100 text-zinc-600',
  Sent: 'bg-blue-100 text-blue-700',
  Accepted: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-orange-100 text-orange-700',
};

export const TAX_RATE_OPTIONS: { label: string; value: TaxRateDisplay; bps: number }[] = [
  { label: '21% BTW', value: 21, bps: 2100 },
  { label: '9% BTW', value: 9, bps: 900 },
  { label: '0% (vrijgesteld)', value: 0, bps: 0 },
];

export const DISCOUNT_TYPE_OPTIONS: { label: string; value: DiscountType }[] = [
  { label: '%', value: 'percentage' },
  { label: '€', value: 'fixed' },
];

// ── Public Quote Proposal types ───────────────────────────────────────────────

export interface AnnotationResponse {
  id: string;
  itemId: string;
  authorType: 'customer' | 'agent';
  authorId?: string;
  text: string;
  isResolved: boolean;
  createdAt: string;
}

export interface PublicQuoteItemResponse {
  id: string;
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  isOptional: boolean;
  isSelected: boolean;
  sortOrder: number;
  totalBeforeTaxCents: number;
  totalTaxCents: number;
  lineTotalCents: number;
  annotations: AnnotationResponse[];
}

export interface PublicQuoteResponse {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  pricingMode: PricingMode;
  organizationName: string;
  customerName: string;
  subtotalCents: number;
  discountAmountCents: number;
  taxTotalCents: number;
  totalCents: number;
  validUntil?: string;
  notes?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  isReadOnly?: boolean;
  items: PublicQuoteItemResponse[];
  vatBreakdown: VatBreakdown[];
}

export interface ToggleItemResponse {
  subtotalCents: number;
  discountAmountCents: number;
  taxTotalCents: number;
  totalCents: number;
  vatBreakdown: VatBreakdown[];
}

export interface AcceptQuoteRequest {
  signatureName: string;
  signatureData: string;
}

export interface RejectQuoteRequest {
  reason?: string | undefined;
}

// ── Activity timeline ─────────────────────────────────────────────────────────

export interface QuoteActivityResponse {
  id: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
