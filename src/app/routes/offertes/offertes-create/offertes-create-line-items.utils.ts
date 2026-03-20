import { centsToEuros, parseQuantityNumber, type QuoteCalculationResponse, type TaxRateDisplay } from '../../../core/services/quotes.types';
import type { DescriptionEditState, LineItemDraft, LineItemField } from './offertes-create.models';

const HTML_DESCRIPTION_PATTERN = /<[^>]+>/;

export interface LineItemEditorState {
  lineItems: LineItemDraft[];
  descriptionEditState: DescriptionEditState;
}

export function createEmptyLineItem(
  lastUsedTaxRate: TaxRateDisplay,
  createUid: () => string,
): LineItemDraft {
  return {
    id: createUid(),
    title: '',
    description: '',
    quantity: '1 x',
    unitPrice: null,
    taxRate: lastUsedTaxRate,
    optional: false,
  };
}

export function addLineItemEditorState(input: {
  lineItems: LineItemDraft[];
  descriptionEditState: DescriptionEditState;
  lastUsedTaxRate: TaxRateDisplay;
  createUid: () => string;
}): LineItemEditorState {
  const item = createEmptyLineItem(input.lastUsedTaxRate, input.createUid);

  return {
    lineItems: [...input.lineItems, item],
    descriptionEditState: { ...input.descriptionEditState, [item.id]: true },
  };
}

export function removeLineItemEditorState(input: {
  lineItems: LineItemDraft[];
  descriptionEditState: DescriptionEditState;
  id: string;
  lastUsedTaxRate: TaxRateDisplay;
  createUid: () => string;
}): LineItemEditorState {
  const removedGeneratedIds = input.lineItems
    .filter((item) => item.parentLineItemId === input.id)
    .map((item) => item.id);

  if (input.lineItems.length <= 1) {
    const item = createEmptyLineItem(input.lastUsedTaxRate, input.createUid);
    return {
      lineItems: [item],
      descriptionEditState: { [item.id]: true },
    };
  }

  const nextDescriptionEditState = { ...input.descriptionEditState };
  delete nextDescriptionEditState[input.id];
  for (const generatedId of removedGeneratedIds) {
    delete nextDescriptionEditState[generatedId];
  }

  return {
    lineItems: input.lineItems.filter(
      (item) => item.id !== input.id && item.parentLineItemId !== input.id,
    ),
    descriptionEditState: nextDescriptionEditState,
  };
}

export function reorderLineItems(
  lineItems: LineItemDraft[],
  previousIndex: number,
  currentIndex: number,
): LineItemDraft[] {
  if (previousIndex === currentIndex) {
    return lineItems;
  }

  const reordered = [...lineItems];
  const [movedItem] = reordered.splice(previousIndex, 1);
  if (!movedItem) {
    return lineItems;
  }

  reordered.splice(currentIndex, 0, movedItem);
  return reordered;
}

export function isDescriptionEditing(
  item: LineItemDraft,
  descriptionEditState: DescriptionEditState,
): boolean {
  const current = descriptionEditState[item.id];
  if (current !== undefined) {
    return current;
  }

  return !(item.catalogProductId && HTML_DESCRIPTION_PATTERN.test(item.description));
}

export function setDescriptionEditing(
  descriptionEditState: DescriptionEditState,
  itemId: string,
  editing: boolean,
): DescriptionEditState {
  return { ...descriptionEditState, [itemId]: editing };
}

export function updateLineItemValue(
  lineItems: LineItemDraft[],
  id: string,
  field: LineItemField,
  value: string | number | boolean | null,
): LineItemDraft[] {
  return lineItems.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return { ...item, [field]: value };
  });
}

export function ensureInitialLineItemState(input: {
  lineItems: LineItemDraft[];
  descriptionEditState: DescriptionEditState;
  lastUsedTaxRate: TaxRateDisplay;
  createUid: () => string;
}): LineItemEditorState {
  if (input.lineItems.length > 0) {
    return {
      lineItems: input.lineItems,
      descriptionEditState: input.descriptionEditState,
    };
  }

  const item = createEmptyLineItem(input.lastUsedTaxRate, input.createUid);
  return {
    lineItems: [item],
    descriptionEditState: { [item.id]: true },
  };
}

export function getLineItemTotal(input: {
  item: LineItemDraft;
  lineItems: LineItemDraft[];
  serverCalc: QuoteCalculationResponse | null;
  getUnitPriceValue: (item: Pick<LineItemDraft, 'unitPrice'>) => number;
}): number {
  if (input.serverCalc?.lines && input.item.description.trim() !== '') {
    const validItems = input.lineItems.filter((lineItem) => lineItem.description.trim() !== '');
    const validIndex = validItems.findIndex((lineItem) => lineItem.id === input.item.id);
    const serverLine = validIndex >= 0 ? input.serverCalc.lines[validIndex] : undefined;
    if (serverLine) {
      return centsToEuros(serverLine.lineTotalCents);
    }
  }

  return parseQuantityNumber(input.item.quantity) * input.getUnitPriceValue(input.item);
}