import {
  eurosToCents,
  taxDisplayToBps,
  type AnalyzeSubsidyDraftRequest,
  type QuoteItemRequest,
} from '../../../core/services/quotes.types';
import type { LineItemDraft } from './offertes-create.models';

const QUILL_EDITOR_SELECTOR = 'app-quote-line-item-row .ql-editor';
const QUANTITY_INPUT_SELECTOR = 'app-quote-line-item-row input[placeholder="1, 10 m2, 1 stuk"]';

export function buildSubsidyAnalysisDraftPayload(input: {
  lineItems: LineItemDraft[];
  getUnitPriceValue: (item: Pick<LineItemDraft, 'unitPrice'>) => number;
}): AnalyzeSubsidyDraftRequest | null {
  const items: QuoteItemRequest[] = input.lineItems
    .filter((item) => item.description.trim() !== '' || item.title.trim() !== '')
    .map((item) => ({
      ...(item.title ? { title: item.title } : {}),
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: eurosToCents(input.getUnitPriceValue(item)),
      taxRateBps: taxDisplayToBps(item.taxRate),
      isOptional: item.optional,
    }));

  if (items.length === 0) {
    return null;
  }

  return { items };
}

export function buildSubsidyAnalysisSourceFingerprint(
  payload: AnalyzeSubsidyDraftRequest | null,
): string | null {
  return payload ? JSON.stringify(payload.items) : null;
}

export function getSubsidyAnalysisSourceItems(lineItems: LineItemDraft[]): LineItemDraft[] {
  const liveDescriptions = readLiveSubsidyDescriptions();
  const liveQuantities = readLiveSubsidyQuantities();

  return lineItems.map((item, index) => ({
    ...item,
    description: liveDescriptions[index] ?? item.description,
    quantity: liveQuantities[index] ?? item.quantity,
  }));
}

function readLiveSubsidyDescriptions(): string[] {
  if (globalThis.document === undefined) {
    return [];
  }

  return Array.from(globalThis.document.querySelectorAll<HTMLElement>(QUILL_EDITOR_SELECTOR))
    .filter((element) => isElementVisible(element))
    .map((element) => element.innerHTML.trim())
    .filter((value) => value !== '');
}

function readLiveSubsidyQuantities(): string[] {
  if (globalThis.document === undefined) {
    return [];
  }

  return Array.from(globalThis.document.querySelectorAll<HTMLInputElement>(QUANTITY_INPUT_SELECTOR))
    .filter((element) => isElementVisible(element))
    .map((element) => element.value.trim())
    .filter((value) => value !== '');
}

function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = globalThis.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}