import type { AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import {
  centsToEuros,
  eurosToCents,
  taxDisplayToBps,
  taxBpsToDisplay,
  type CreateQuoteFeedbackRequest,
  type DiscountType,
  type PricingMode,
  type QuoteAttachmentRequest,
  type QuoteISDESubsidy,
  type QuoteItemRequest,
  type QuoteResponse,
  type QuoteURLRequest,
} from '../../../core/services/quotes.types';
import type { LineItemDraft, QuoteFeedbackDiff, UrlDraft } from './offertes-create.models';

export interface QuoteDraftSummaryValue {
  discountType: DiscountType;
  discountValue: number | null;
  validUntil: string | null;
  notes: string | null;
}

export interface QuoteDraftPayloadInput {
  summary: QuoteDraftSummaryValue;
  lineItems: LineItemDraft[];
  attachmentDrafts: AttachmentDraft[];
  urlDrafts: UrlDraft[];
  leadServiceId: string | null;
  pricingMode: PricingMode;
  financingDisclaimer: boolean;
  pagePerItem: boolean;
  isdeSubsidy: QuoteISDESubsidy;
  getUnitPriceValue: (item: Pick<LineItemDraft, 'unitPrice'>) => number;
}

export interface QuoteDraftPayload {
  leadServiceId?: string;
  items: QuoteItemRequest[];
  attachments: QuoteAttachmentRequest[];
  urls: QuoteURLRequest[];
  isdeSubsidy: QuoteISDESubsidy;
  discountType: DiscountType;
  discountValue: number;
  pricingMode: PricingMode;
  financingDisclaimer: boolean;
  pagePerItem: boolean;
  validUntil?: string;
  notes?: string;
}

export interface QuoteFeedbackRequestsInput {
  quote: QuoteResponse | null;
  lineItems: LineItemDraft[];
  leadServiceId: string | null;
  getUnitPriceValue: (item: Pick<LineItemDraft, 'unitPrice'>) => number;
}

export interface QuoteHydrationSnapshot {
  lineItems: LineItemDraft[];
  descriptionEditState: Record<string, boolean>;
  attachmentDrafts: AttachmentDraft[];
  urlDrafts: UrlDraft[];
  summary: QuoteDraftSummaryValue;
  discountDisplayValue: number;
  pricingMode: PricingMode;
  financingDisclaimer: boolean;
  pagePerItem: boolean;
  lastUsedTaxRate: LineItemDraft['taxRate'];
}

const HTML_DESCRIPTION_PATTERN = /<[^>]+>/;

export function buildQuoteDraftPayload(input: QuoteDraftPayloadInput): QuoteDraftPayload {
  const dType = input.summary.discountType;
  const dVal =
    dType === 'fixed'
      ? eurosToCents(input.summary.discountValue ?? 0)
      : (input.summary.discountValue ?? 0);

  const items: QuoteItemRequest[] = input.lineItems.map((item) => ({
    ...(item.title ? { title: item.title } : {}),
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: eurosToCents(input.getUnitPriceValue(item)),
    taxRateBps: taxDisplayToBps(item.taxRate),
    isOptional: item.optional,
    ...(item.catalogProductId ? { catalogProductId: item.catalogProductId } : {}),
  }));

  const attachments: QuoteAttachmentRequest[] = input.attachmentDrafts
    .filter((attachment) => attachment.fileKey)
    .map((attachment, index) => ({
      filename: attachment.filename,
      fileKey: attachment.fileKey,
      source: attachment.source,
      ...(attachment.catalogProductId ? { catalogProductId: attachment.catalogProductId } : {}),
      enabled: attachment.enabled,
      sortOrder: index,
    }));

  const urls: QuoteURLRequest[] = input.urlDrafts.map((url) => ({
    label: url.label,
    href: url.href,
    ...(url.catalogProductId ? { catalogProductId: url.catalogProductId } : {}),
  }));

  return {
    ...(input.leadServiceId ? { leadServiceId: input.leadServiceId } : {}),
    items,
    attachments,
    urls,
    isdeSubsidy: input.isdeSubsidy,
    discountType: dType,
    discountValue: dVal,
    pricingMode: input.pricingMode,
    financingDisclaimer: input.financingDisclaimer,
    pagePerItem: input.pagePerItem,
    ...(input.summary.validUntil ? { validUntil: `${input.summary.validUntil}T00:00:00Z` } : {}),
    ...(input.summary.notes ? { notes: input.summary.notes } : {}),
  };
}

export function buildQuoteFeedbackRequests(
  input: QuoteFeedbackRequestsInput,
): CreateQuoteFeedbackRequest[] {
  if (!input.quote) {
    return [];
  }

  const originalItems = new Map(input.quote.items.map((item) => [item.id, item]));
  const leadServiceId = input.leadServiceId ?? input.quote.leadServiceId;
  const requests: CreateQuoteFeedbackRequest[] = [];

  for (const item of input.lineItems) {
    const original = originalItems.get(item.id);
    if (!original) {
      continue;
    }

    for (const diff of buildFeedbackDiffs(original, item, input.getUnitPriceValue)) {
      requests.push({
        ...(leadServiceId ? { leadServiceId } : {}),
        fieldChanged: diff.fieldChanged,
        aiValue: diff.aiValue,
        humanValue: diff.humanValue,
      });
    }
  }

  return requests;
}

export function buildQuoteHydrationSnapshot(quote: QuoteResponse): QuoteHydrationSnapshot {
  const lineItems = quote.items.map((item) => ({
    id: item.id,
    title: item.title ?? '',
    description: item.description,
    quantity: item.quantity,
    unitPrice: centsToEuros(item.unitPriceCents),
    taxRate: taxBpsToDisplay(item.taxRateBps),
    optional: item.isOptional,
    ...(item.catalogProductId == null ? {} : { catalogProductId: item.catalogProductId }),
  }));

  return {
    lineItems,
    descriptionEditState: Object.fromEntries(
      quote.items.map((item) => [
        item.id,
        !(item.catalogProductId && HTML_DESCRIPTION_PATTERN.test(item.description)),
      ]),
    ),
    attachmentDrafts: (quote.attachments ?? []).map((attachment) => ({
      uid: attachment.id,
      filename: attachment.filename,
      fileKey: attachment.fileKey,
      source: attachment.source,
      ...(attachment.catalogProductId == null
        ? {}
        : { catalogProductId: attachment.catalogProductId }),
      enabled: attachment.enabled,
      sortOrder: attachment.sortOrder,
    })),
    urlDrafts: (quote.urls ?? []).map((url) => ({
      uid: url.id,
      label: url.label,
      href: url.href,
      ...(url.catalogProductId == null ? {} : { catalogProductId: url.catalogProductId }),
    })),
    summary: {
      discountType: quote.discountType,
      discountValue:
        quote.discountType === 'fixed' ? centsToEuros(quote.discountValue) : quote.discountValue,
      validUntil: quote.validUntil ? (quote.validUntil.split('T')[0] ?? null) : null,
      notes: quote.notes ?? '',
    },
    discountDisplayValue:
      quote.discountType === 'fixed' ? centsToEuros(quote.discountValue) : quote.discountValue,
    pricingMode: quote.pricingMode ?? 'exclusive',
    financingDisclaimer: quote.financingDisclaimer ?? false,
    pagePerItem: quote.pagePerItem ?? false,
    lastUsedTaxRate:
      quote.items[0]?.taxRateBps == null ? 21 : taxBpsToDisplay(quote.items[0].taxRateBps),
  };
}

function buildFeedbackDiffs(
  original: QuoteResponse['items'][number],
  item: LineItemDraft,
  getUnitPriceValue: (item: Pick<LineItemDraft, 'unitPrice'>) => number,
): QuoteFeedbackDiff[] {
  const normalizedUnitPrice = eurosToCents(getUnitPriceValue(item));
  const normalizedTaxRate = taxDisplayToBps(item.taxRate);
  const diffs: QuoteFeedbackDiff[] = [];

  appendFeedbackDiff(
    diffs,
    original.description !== item.description,
    'description',
    { lineItemId: original.id, description: original.description },
    { lineItemId: original.id, description: item.description },
  );

  appendFeedbackDiff(
    diffs,
    original.quantity !== item.quantity,
    'quantity',
    { lineItemId: original.id, quantity: original.quantity },
    { lineItemId: original.id, quantity: item.quantity },
  );

  appendFeedbackDiff(
    diffs,
    original.unitPriceCents !== normalizedUnitPrice,
    'unitPriceCents',
    { lineItemId: original.id, value: original.unitPriceCents },
    { lineItemId: original.id, value: normalizedUnitPrice },
  );

  appendFeedbackDiff(
    diffs,
    original.taxRateBps !== normalizedTaxRate,
    'taxRateBps',
    { lineItemId: original.id, value: original.taxRateBps },
    { lineItemId: original.id, value: normalizedTaxRate },
  );

  appendFeedbackDiff(
    diffs,
    original.isOptional !== item.optional,
    'isOptional',
    { lineItemId: original.id, value: original.isOptional },
    { lineItemId: original.id, value: item.optional },
  );

  return diffs;
}

function appendFeedbackDiff(
  diffs: QuoteFeedbackDiff[],
  condition: boolean,
  fieldChanged: QuoteFeedbackDiff['fieldChanged'],
  aiValue: QuoteFeedbackDiff['aiValue'],
  humanValue: QuoteFeedbackDiff['humanValue'],
): void {
  if (!condition) {
    return;
  }

  diffs.push({ fieldChanged, aiValue, humanValue });
}