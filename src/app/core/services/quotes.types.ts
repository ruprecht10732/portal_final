// Quote types - frontend-only for now, ready for backend integration

import type { Lead } from './leads.types';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type DiscountType = 'percentage' | 'fixed';

export type TaxRate = 0 | 9 | 21;

export type PricingMode = 'exclusive' | 'inclusive';

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: string; // Free-form: "5 x", "10 m²", "3 uur", etc.
  unitPrice: number;
  taxRate: TaxRate;
  optional: boolean;
  total: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  leadId: string;
  lead?: Lead; // populated on fetch
  status: QuoteStatus;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  pricingMode: PricingMode;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteRequest {
  leadId: string;
  lineItems: Omit<QuoteLineItem, 'id' | 'total'>[];
  discountType?: DiscountType;
  discountValue?: number;
  pricingMode?: PricingMode;
  validUntil?: string;
  notes?: string;
}

export interface UpdateQuoteRequest {
  lineItems?: Omit<QuoteLineItem, 'id' | 'total'>[];
  discountType?: DiscountType;
  discountValue?: number;
  pricingMode?: PricingMode;
  validUntil?: string;
  notes?: string;
}

export interface QuoteListResponse {
  items: Quote[];
  total: number;
}

/**
 * Parse numeric value from free-form quantity string.
 * Examples: "5 x" -> 5, "10 m²" -> 10, "3.5 uur" -> 3.5
 */
export function parseQuantityNumber(quantity: string): number {
  const match = /^([\d.,]+)/.exec(quantity);
  if (!match?.[1]) return 1;
  return Number.parseFloat(match[1].replace(',', '.')) || 1;
}

// Status display helpers
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
};

export const TAX_RATE_OPTIONS: { label: string; value: TaxRate }[] = [
  { label: '21% BTW', value: 21 },
  { label: '9% BTW', value: 9 },
  { label: '0% (vrijgesteld)', value: 0 },
];

export const DISCOUNT_TYPE_OPTIONS: { label: string; value: DiscountType }[] = [
  { label: '%', value: 'percentage' },
  { label: '€', value: 'fixed' },
];
