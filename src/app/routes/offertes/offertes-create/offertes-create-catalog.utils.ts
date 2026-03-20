import { map, Observable, of } from 'rxjs';
import {
  CatalogService,
  type AutocompleteItemResponse,
  type MaterialPricingMode,
  type Product,
} from '../../../core/services/catalog.service';
import { centsToEuros, taxBpsToDisplay, type TaxRateDisplay } from '../../../core/services/quotes.types';
import { type GhostSuggestion } from '../../../shared/components/ghost-text/ghost-text.directive';
import type { AttachmentDraft } from '../../../shared/components/attachment-panel/attachment-panel.component';
import type { DescriptionEditState, LineItemDraft, UrlDraft } from './offertes-create.models';

const materialExpandRequestSeq = new Map<string, number>();

export interface GhostAcceptanceSnapshot {
  catalogProductId?: string;
  initialDescription: string;
  previousGeneratedIds: string[];
  nextLineItems: LineItemDraft[];
  newAttachments: AttachmentDraft[];
  newUrls: UrlDraft[];
}

export interface MaterialExpansionSnapshot {
  generatedRows: LineItemDraft[];
  nextLineItems: LineItemDraft[];
}

export interface GhostAcceptanceResult {
  accepted: GhostAcceptanceSnapshot;
  product: AutocompleteItemResponse;
  requestSeq: number;
}

export function searchCatalogSuggestions(
  catalogService: CatalogService,
  query: string,
): Observable<GhostSuggestion[]> {
  return catalogService.searchForAutocomplete(query, 10).pipe(
    map((items) =>
      items.map(
        (item) =>
          ({
            displayText: item.title,
            payload: item,
          }) satisfies GhostSuggestion,
      ),
    ),
  );
}

export function acceptGhostSuggestion(input: {
  itemId: string;
  suggestion: GhostSuggestion;
  lineItems: LineItemDraft[];
  attachmentCount: number;
  createUid: () => string;
}): GhostAcceptanceResult {
  const product = input.suggestion.payload as AutocompleteItemResponse;
  const accepted = buildGhostAcceptanceSnapshot({
    itemId: input.itemId,
    product,
    lineItems: input.lineItems,
    attachmentCount: input.attachmentCount,
    createUid: input.createUid,
  });
  const requestSeq = (materialExpandRequestSeq.get(input.itemId) ?? 0) + 1;
  materialExpandRequestSeq.set(input.itemId, requestSeq);

  return {
    accepted,
    product,
    requestSeq,
  };
}

export function expandAcceptedMaterials(
  catalogService: CatalogService,
  input: {
    itemId: string;
    requestSeq: number;
    accepted: GhostAcceptanceSnapshot;
    product: AutocompleteItemResponse;
    includedMaterialsLabel: string;
    createUid: () => string;
    getLineItems: () => LineItemDraft[];
  },
): Observable<MaterialExpansionSnapshot | null> {
  const catalogProductId = input.accepted.catalogProductId;
  if (!catalogProductId) {
    return of(null);
  }

  return catalogService.listProductMaterials(catalogProductId).pipe(
    map((materials) => {
      if (materialExpandRequestSeq.get(input.itemId) !== input.requestSeq) {
        return null;
      }

      const lineItems = input.getLineItems();
      const currentParent = lineItems.find((item) => item.id === input.itemId);
      if (!currentParent) {
        return null;
      }

      if (currentParent.catalogProductId !== catalogProductId) {
        return null;
      }

      if (currentParent.description !== input.accepted.initialDescription) {
        return null;
      }

      return buildMaterialExpansionSnapshot({
        itemId: input.itemId,
        materials,
        lineItems,
        parentTaxRate: currentParent.taxRate,
        product: input.product,
        includedMaterialsLabel: input.includedMaterialsLabel,
        createUid: input.createUid,
      });
    }),
  );
}

export function buildGhostAcceptanceDescriptionState(input: {
  state: DescriptionEditState;
  itemId: string;
  previousGeneratedIds: string[];
}): DescriptionEditState {
  const next = { ...input.state, [input.itemId]: false };
  for (const id of input.previousGeneratedIds) {
    delete next[id];
  }
  return next;
}

export function buildMaterialExpansionDescriptionState(input: {
  state: DescriptionEditState;
  itemId: string;
  generatedRows: LineItemDraft[];
}): DescriptionEditState {
  const next = { ...input.state, [input.itemId]: false };
  for (const row of input.generatedRows) {
    next[row.id] = false;
  }
  return next;
}

export function catalogProductId(item: AutocompleteItemResponse): string | undefined {
  if (item.sourceType !== 'catalog') {
    return undefined;
  }

  return item.catalogProductId ?? item.id;
}

export function formatAutocompleteDescription(item: AutocompleteItemResponse): string {
  if (item.sourceType === 'catalog') {
    return formatCatalogDescription(item.title, item.description ?? '');
  }

  return formatReferenceDescription(item.title, item.description ?? '');
}

export function buildGhostAcceptanceSnapshot(input: {
  itemId: string;
  product: AutocompleteItemResponse;
  lineItems: LineItemDraft[];
  attachmentCount: number;
  createUid: () => string;
}): GhostAcceptanceSnapshot {
  const nextCatalogProductId = catalogProductId(input.product);
  const initialDescription = formatAutocompleteDescription(input.product);
  const previousGeneratedIds = input.lineItems
    .filter((item) => item.parentLineItemId === input.itemId)
    .map((item) => item.id);

  const nextLineItems = input.lineItems
    .filter((item) => item.parentLineItemId !== input.itemId)
    .map((item) => {
      if (item.id !== input.itemId) {
        return item;
      }

      const updatedItem = {
        ...item,
        title: input.product.title,
        description: initialDescription,
        quantity: item.quantity || '1 x',
        unitPrice: centsToEuros(input.product.unitPriceCents || input.product.priceCents),
        taxRate: taxBpsToDisplay(input.product.vatRateBps),
      };

      if (nextCatalogProductId) {
        return { ...updatedItem, catalogProductId: nextCatalogProductId };
      }

      const { catalogProductId: _catalogProductId, ...withoutCatalogProductId } = updatedItem;
      return withoutCatalogProductId;
    });

  const newAttachments =
    nextCatalogProductId && input.product.documents?.length
      ? input.product.documents.map((document, index) => ({
          uid: input.createUid(),
          filename: document.filename,
          fileKey: document.fileKey,
          source: 'catalog' as const,
          catalogProductId: nextCatalogProductId,
          catalogAssetId: document.id,
          enabled: true,
          sortOrder: input.attachmentCount + index,
        }))
      : [];

  const newUrls =
    nextCatalogProductId && input.product.urls?.length
      ? input.product.urls.map((url) => ({
          uid: input.createUid(),
          label: url.label,
          href: url.href,
          catalogProductId: nextCatalogProductId,
        }))
      : [];

  return {
    initialDescription,
    previousGeneratedIds,
    nextLineItems,
    newAttachments,
    newUrls,
    ...(nextCatalogProductId ? { catalogProductId: nextCatalogProductId } : {}),
  };
}

export function buildMaterialExpansionSnapshot(input: {
  itemId: string;
  materials: Product[];
  lineItems: LineItemDraft[];
  parentTaxRate: TaxRateDisplay;
  product: AutocompleteItemResponse;
  includedMaterialsLabel: string;
  createUid: () => string;
}): MaterialExpansionSnapshot {
  const includedTitles = input.materials
    .filter((material) => material.pricingMode === 'included')
    .map((material) => material.title.trim())
    .filter(Boolean);

  const parentDescriptionBase = formatCatalogDescription(
    input.product.title,
    input.product.description || '',
  );
  const parentDescription = formatDescriptionWithIncludedMaterials(
    parentDescriptionBase,
    includedTitles,
    input.includedMaterialsLabel,
  );

  const generatedRows = createGeneratedMaterialRows(
    input.itemId,
    input.materials,
    input.parentTaxRate,
    input.createUid,
  );

  const withoutGenerated = input.lineItems.filter((item) => item.parentLineItemId !== input.itemId);
  const parentIndex = withoutGenerated.findIndex((item) => item.id === input.itemId);
  if (parentIndex === -1) {
    return { generatedRows: [], nextLineItems: withoutGenerated };
  }

  const parentLine = withoutGenerated[parentIndex];
  if (!parentLine) {
    return { generatedRows: [], nextLineItems: withoutGenerated };
  }

  const updatedParent: LineItemDraft = {
    ...parentLine,
    description: parentDescription,
  };

  return {
    generatedRows,
    nextLineItems: [
      ...withoutGenerated.slice(0, parentIndex),
      updatedParent,
      ...generatedRows,
      ...withoutGenerated.slice(parentIndex + 1),
    ],
  };
}

function createGeneratedMaterialRows(
  parentLineItemId: string,
  materials: Product[],
  fallbackTaxRate: TaxRateDisplay,
  createUid: () => string,
): LineItemDraft[] {
  return materials
    .filter(
      (material) => material.pricingMode === 'additional' || material.pricingMode === 'optional',
    )
    .map((material) =>
      createGeneratedMaterialRow(parentLineItemId, material, fallbackTaxRate, createUid),
    );
}

function createGeneratedMaterialRow(
  parentLineItemId: string,
  material: Product,
  fallbackTaxRate: TaxRateDisplay,
  createUid: () => string,
): LineItemDraft {
  const pricingMode: MaterialPricingMode =
    material.pricingMode === 'optional' ? 'optional' : 'additional';
  return {
    id: createUid(),
    parentLineItemId,
    title: material.title,
    description: formatCatalogDescription(material.title, material.description || ''),
    quantity: '1 x',
    unitPrice: centsToEuros(material.unitPriceCents || material.priceCents),
    taxRate: fallbackTaxRate,
    optional: pricingMode === 'optional',
    catalogProductId: material.id,
  };
}

function formatCatalogDescription(title: string, descriptionHtml: string): string {
  const safeTitle = escapeHtml(title.trim());
  const body = descriptionHtml.trim();
  if (!safeTitle) return body;
  if (!body) return `<p><strong>${safeTitle}</strong></p>`;
  return `<p><strong>${safeTitle}</strong></p>${body}`;
}

function formatReferenceDescription(title: string, description: string): string {
  const safeTitle = escapeHtml(title.trim());
  const safeBody = escapeHtml(description.trim()).replaceAll('\n', '<br>');
  if (!safeTitle) {
    return safeBody;
  }
  if (!safeBody) {
    return `<p><strong>${safeTitle}</strong></p>`;
  }
  return `<p><strong>${safeTitle}</strong></p><p>${safeBody}</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDescriptionWithIncludedMaterials(
  baseDescription: string,
  includedTitles: string[],
  includedMaterialsLabel: string,
): string {
  if (includedTitles.length === 0) return baseDescription;

  const includedBlockLines = [
    includedMaterialsLabel,
    ...includedTitles.map((title) => `- ${title}`),
  ];
  return `${baseDescription}<br><br>${includedBlockLines.join('<br>')}`;
}