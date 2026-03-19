import type { SelectOption } from '../../../shared/components/select/select.component';
import type { AnalyzeSubsidyDraftResult } from '../../../core/services/quotes.types';
import { parseQuantityNumber } from '../../../core/services/quotes.types';
import type { RequestedInstallation, RequestedMeasure } from '../../../core/services/isde.types';
import type {
  EditableSubsidyInstallationField,
  EditableSubsidyMeasureField,
  EditableSubsidyValue,
  ISDEInstallationKind,
  ISDEMeasureID,
  ISDEMeasureOption,
  LineItemDraft,
  SubsidyInstallationDraft,
  SubsidyMeasureDraft,
} from './offertes-create.models';

const HTML_TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/g;
const AREA_PATTERN = /(\d+(?:[.,]\d+)?)\s*(m2|m²)/i;

export const ISDE_MEASURE_OPTIONS: ISDEMeasureOption[] = [
  { value: 'roof', label: 'Dakisolatie', performanceLabel: 'Rd-waarde' },
  { value: 'attic', label: 'Zolder/vliering isolatie', performanceLabel: 'Rd-waarde' },
  { value: 'facade', label: 'Gevelisolatie', performanceLabel: 'Rd-waarde' },
  { value: 'cavity_wall', label: 'Spouwmuurisolatie', performanceLabel: 'Rd-waarde' },
  { value: 'floor', label: 'Vloerisolatie', performanceLabel: 'Rd-waarde' },
  { value: 'crawl_space', label: 'Bodemisolatie (kruipruimte)', performanceLabel: 'Rd-waarde' },
  { value: 'hr_plus_plus', label: 'HR++ glas', performanceLabel: 'U-waarde' },
  { value: 'triple_glass', label: 'Triple glas', performanceLabel: 'U-waarde' },
  { value: 'vacuum_glass', label: 'Vacuumglas', performanceLabel: 'U-waarde' },
  { value: 'glass_panel_low', label: 'Isolerend paneel', performanceLabel: 'U-waarde paneel' },
  {
    value: 'glass_panel_high',
    label: 'Isolerend paneel hoogwaardig',
    performanceLabel: 'U-waarde paneel',
  },
  { value: 'insulated_door_low', label: 'Isolerende deur', performanceLabel: 'Ud-waarde' },
  {
    value: 'insulated_door_high',
    label: 'Isolerende deur hoogwaardig',
    performanceLabel: 'Ud-waarde',
  },
];

export const ISDE_INSTALLATION_KIND_OPTIONS: SelectOption<ISDEInstallationKind>[] = [
  { label: 'Meldcode', value: 'meldcode' },
  { label: 'Ventilatie', value: 'ventilation' },
  { label: 'Lucht-water warmtepomp', value: 'heat_pump' },
  { label: 'Warmtenet', value: 'warmtenet' },
  { label: 'Elektrische kookvoorziening', value: 'electric_cooking' },
];

export const ISDE_HEAT_PUMP_TYPE_OPTIONS: SelectOption<
  SubsidyInstallationDraft['heatPumpType']
>[] = [
  { label: 'Lucht-water', value: 'air_water' },
  { label: 'Grond-water', value: 'ground_water' },
  { label: 'Water-water', value: 'water_water' },
  { label: 'Warmtepompboiler', value: 'heat_pump_boiler' },
];

export const ISDE_HEAT_PUMP_LABEL_OPTIONS: SelectOption<
  SubsidyInstallationDraft['heatPumpEnergyLabel']
>[] = [
  { label: 'A++', value: 'A++' },
  { label: 'A+++', value: 'A+++' },
];

export const ISDE_EXECUTION_YEAR_OPTIONS: SelectOption<number>[] = [
  { label: '2024', value: 2024 },
  { label: '2025', value: 2025 },
  { label: '2026+', value: 2026 },
];

export function defaultSubsidyExecutionYear(referenceDate = new Date()): number {
  return referenceDate.getFullYear() >= 2026 ? 2026 : Math.max(referenceDate.getFullYear(), 2024);
}

export function createDraftUid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (char) => {
    const randomValue = Math.trunc(Math.random() * 16);
    const nextValue = char === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return nextValue.toString(16);
  });
}

export function buildSubsidyMeasuresFromAIResult(
  result: AnalyzeSubsidyDraftResult,
  inferredMeasures: SubsidyMeasureDraft[],
  createUid: () => string,
): SubsidyMeasureDraft[] {
  const suggestedMeasureIds = extractAISuggestedMeasureIds(result);
  if (suggestedMeasureIds.length === 0) {
    return inferredMeasures;
  }

  const remainingInferred = [...inferredMeasures];
  const aiMeasures = suggestedMeasureIds.map((measureId) => {
    const matchingIndex = remainingInferred.findIndex((row) => row.measureId === measureId);
    if (matchingIndex >= 0) {
      const [matchingMeasure] = remainingInferred.splice(matchingIndex, 1);
      if (matchingMeasure) {
        return matchingMeasure;
      }
    }

    return {
      uid: createUid(),
      measureId,
      areaM2: 20,
      performanceValue: defaultPerformanceValueForMeasure(measureId),
      hasMKIBonus: false,
      frameReplaced: measureId === 'triple_glass' || measureId === 'vacuum_glass',
      stackedWithPairedMeasure: false,
    } satisfies SubsidyMeasureDraft;
  });

  return [...aiMeasures, ...remainingInferred];
}

export function inferSubsidyMeasureFromLineItem(
  item: LineItemDraft,
  createUid: () => string,
): SubsidyMeasureDraft | null {
  const normalizedText = normalizeSubsidySourceText(`${item.title} ${item.description}`);
  const measureId = detectMeasureIdFromText(normalizedText);

  if (!measureId) {
    return null;
  }

  return {
    uid: createUid(),
    measureId,
    areaM2: detectAreaM2(item.quantity, normalizedText),
    performanceValue: defaultPerformanceValueForMeasure(measureId),
    hasMKIBonus: false,
    frameReplaced: measureId === 'triple_glass' || measureId === 'vacuum_glass',
    stackedWithPairedMeasure: false,
  };
}

export function createDefaultSubsidyMeasure(createUid: () => string): SubsidyMeasureDraft {
  return {
    uid: createUid(),
    measureId: 'roof',
    areaM2: 20,
    performanceValue: defaultPerformanceValueForMeasure('roof'),
    hasMKIBonus: false,
    frameReplaced: false,
    stackedWithPairedMeasure: false,
  };
}

export function createDefaultSubsidyInstallation(
  createUid: () => string,
): SubsidyInstallationDraft {
  return {
    uid: createUid(),
    kind: 'meldcode',
    meldcode: '',
    heatPumpType: 'air_water',
    heatPumpEnergyLabel: 'A++',
    isAdditionalUnit: false,
    isSplitSystem: false,
  };
}

export function applySubsidyMeasureUpdate(
  row: SubsidyMeasureDraft,
  field: EditableSubsidyMeasureField,
  value: EditableSubsidyValue,
): SubsidyMeasureDraft {
  switch (field) {
    case 'measureId':
      return typeof value === 'string'
        ? normalizeSubsidyMeasureForType({ ...row, measureId: value as ISDEMeasureID }, row.measureId)
        : row;
    case 'areaM2':
      return { ...row, areaM2: Number(value ?? 0) };
    case 'performanceValue':
      return setOptionalMeasureNumber(row, 'performanceValue', value);
    case 'framePerformanceValue':
      return setOptionalMeasureNumber(row, 'framePerformanceValue', value);
    case 'hasMKIBonus':
      return { ...row, hasMKIBonus: !!value };
    case 'frameReplaced':
      return { ...row, frameReplaced: !!value };
    case 'stackedWithPairedMeasure':
      return { ...row, stackedWithPairedMeasure: !!value };
    default:
      return row;
  }
}

export function applySubsidyInstallationUpdate(
  row: SubsidyInstallationDraft,
  field: EditableSubsidyInstallationField,
  value: EditableSubsidyValue,
): SubsidyInstallationDraft {
  switch (field) {
    case 'kind':
      return typeof value === 'string' ? { ...row, kind: value as ISDEInstallationKind } : row;
    case 'meldcode':
      return typeof value === 'string' ? { ...row, meldcode: value.toUpperCase().trim() } : row;
    case 'heatPumpType':
      return typeof value === 'string'
        ? { ...row, heatPumpType: value as SubsidyInstallationDraft['heatPumpType'] }
        : row;
    case 'heatPumpEnergyLabel':
      return typeof value === 'string'
        ? {
            ...row,
            heatPumpEnergyLabel: value as SubsidyInstallationDraft['heatPumpEnergyLabel'],
          }
        : row;
    case 'thermalPowerKW':
      return setOptionalInstallationNumber(row, 'thermalPowerKW', value);
    case 'refrigerantChargeKg':
      return setOptionalInstallationNumber(row, 'refrigerantChargeKg', value);
    case 'refrigerantGWP':
      return setOptionalInstallationNumber(row, 'refrigerantGWP', value);
    case 'isAdditionalUnit':
      return { ...row, isAdditionalUnit: !!value };
    case 'isSplitSystem':
      return { ...row, isSplitSystem: !!value };
    default:
      return row;
  }
}

export function toRequestedMeasure(row: SubsidyMeasureDraft): RequestedMeasure {
  const requestedMeasure: RequestedMeasure = {
    measureId: row.measureId,
    areaM2: row.areaM2,
    hasMKIBonus: row.hasMKIBonus,
    frameReplaced: row.frameReplaced,
    stackedWithPairedMeasure: row.stackedWithPairedMeasure,
  };

  if (row.performanceValue !== undefined) {
    requestedMeasure.performanceValue = row.performanceValue;
  }
  if (row.framePerformanceValue !== undefined) {
    requestedMeasure.framePerformanceValue = row.framePerformanceValue;
  }

  return requestedMeasure;
}

export function toSubsidyMeasureDraft(
  measure: RequestedMeasure,
  createUid: () => string,
): SubsidyMeasureDraft {
  return {
    uid: createUid(),
    measureId: measure.measureId as ISDEMeasureID,
    areaM2: measure.areaM2,
    ...(measure.performanceValue == null ? {} : { performanceValue: measure.performanceValue }),
    ...(measure.framePerformanceValue == null
      ? {}
      : { framePerformanceValue: measure.framePerformanceValue }),
    hasMKIBonus: !!measure.hasMKIBonus,
    frameReplaced: !!measure.frameReplaced,
    stackedWithPairedMeasure: !!measure.stackedWithPairedMeasure,
  };
}

export function toRequestedInstallation(
  row: SubsidyInstallationDraft,
): RequestedInstallation {
  const requestedInstallation: RequestedInstallation = { kind: row.kind };
  const normalizedMeldcode = row.meldcode.trim().toUpperCase();

  if (normalizedMeldcode.length > 0) {
    requestedInstallation.meldcode = normalizedMeldcode;
  }
  if (row.kind !== 'heat_pump') {
    return requestedInstallation;
  }

  requestedInstallation.heatPumpType = row.heatPumpType;
  requestedInstallation.heatPumpEnergyLabel = row.heatPumpEnergyLabel;
  requestedInstallation.isAdditionalUnit = row.isAdditionalUnit;
  requestedInstallation.isSplitSystem = row.isSplitSystem;

  if (row.thermalPowerKW !== undefined) {
    requestedInstallation.thermalPowerKW = row.thermalPowerKW;
  }
  if (row.refrigerantChargeKg !== undefined) {
    requestedInstallation.refrigerantChargeKg = row.refrigerantChargeKg;
  }
  if (row.refrigerantGWP !== undefined) {
    requestedInstallation.refrigerantGWP = row.refrigerantGWP;
  }

  return requestedInstallation;
}

export function toSubsidyInstallationDraft(
  installation: RequestedInstallation,
  createUid: () => string,
): SubsidyInstallationDraft {
  return {
    uid: createUid(),
    kind: (installation.kind || 'meldcode') as SubsidyInstallationDraft['kind'],
    meldcode: installation.meldcode ?? '',
    heatPumpType: installation.heatPumpType || 'air_water',
    heatPumpEnergyLabel: (installation.heatPumpEnergyLabel || 'A++') as SubsidyInstallationDraft['heatPumpEnergyLabel'],
    ...(installation.thermalPowerKW == null ? {} : { thermalPowerKW: installation.thermalPowerKW }),
    isAdditionalUnit: !!installation.isAdditionalUnit,
    isSplitSystem: !!installation.isSplitSystem,
    ...(installation.refrigerantChargeKg == null
      ? {}
      : { refrigerantChargeKg: installation.refrigerantChargeKg }),
    ...(installation.refrigerantGWP == null
      ? {}
      : { refrigerantGWP: installation.refrigerantGWP }),
  };
}

export function measurePerformanceHint(measureId: ISDEMeasureID): string {
  if (measurePerformanceKind(measureId) === 'u') {
    return 'Lagere U-waarde is beter. Voor HR++ is meestal 1,2 of lager nodig.';
  }

  return 'Hogere Rd-waarde is beter. Voor de meeste isolatiemaatregelen is minimaal 3,5 nodig.';
}

export function measurePerformanceExample(measureId: ISDEMeasureID): string {
  switch (measureId) {
    case 'hr_plus_plus':
    case 'glass_panel_low':
    case 'cavity_wall':
      return 'Bijv. 1,1';
    case 'triple_glass':
    case 'vacuum_glass':
    case 'glass_panel_high':
      return 'Bijv. 0,7';
    case 'insulated_door_low':
      return 'Bijv. 1,5';
    case 'insulated_door_high':
      return 'Bijv. 1,0';
    default:
      return 'Bijv. 3,5';
  }
}

export function measureNeedsFrameFields(measureId: ISDEMeasureID): boolean {
  return measureId === 'triple_glass' || measureId === 'vacuum_glass';
}

export function measureSupportsMKI(measureId: ISDEMeasureID): boolean {
  return ['roof', 'attic', 'facade', 'cavity_wall', 'floor', 'crawl_space'].includes(measureId);
}

export function measureSupportsPairStacking(measureId: ISDEMeasureID): boolean {
  return ['roof', 'attic', 'floor', 'crawl_space'].includes(measureId);
}

export function installationUsesMeldcode(kind: ISDEInstallationKind): boolean {
  return kind === 'meldcode';
}

export function installationUsesHeatPumpFormula(kind: ISDEInstallationKind): boolean {
  return kind === 'heat_pump';
}

function extractAISuggestedMeasureIds(result: AnalyzeSubsidyDraftResult): ISDEMeasureID[] {
  let rawMeasureIds: string[] = [];
  if (Array.isArray(result.measure_type_ids)) {
    rawMeasureIds = result.measure_type_ids;
  } else if (result.measure_type_id) {
    rawMeasureIds = [result.measure_type_id];
  }

  return rawMeasureIds.filter((value): value is ISDEMeasureID => isISDEMeasureID(value));
}

function isISDEMeasureID(value: string): value is ISDEMeasureID {
  return [
    'roof',
    'attic',
    'facade',
    'cavity_wall',
    'floor',
    'crawl_space',
    'hr_plus_plus',
    'triple_glass',
    'vacuum_glass',
    'glass_panel_low',
    'glass_panel_high',
    'insulated_door_low',
    'insulated_door_high',
  ].includes(value);
}

function normalizeSubsidySourceText(value: string): string {
  return value
    .replaceAll(HTML_TAG_PATTERN, ' ')
    .toLowerCase()
    .replaceAll('＋', '+')
    .replaceAll('plusplus', '++')
    .replaceAll('plus plus', '++')
    .replaceAll('/', ' ')
    .replaceAll('-', ' ')
    .replaceAll(WHITESPACE_PATTERN, ' ')
    .trim();
}

function detectMeasureIdFromText(text: string): ISDEMeasureID | null {
  if (/\btriple\s*glas|tripleglas|hr\s*\+\+\+|hr\+\+\+/.test(text)) return 'triple_glass';
  if (/\bhr\s*\+\+|hr\+\+/.test(text)) return 'hr_plus_plus';
  if (/\bvacu+\w*\s*glas|vacuumglas/.test(text)) return 'vacuum_glass';
  if (/\bzolder|vliering/.test(text)) return 'attic';
  if (/\bkruipruimte|bodemisolatie/.test(text)) return 'crawl_space';
  if (/\bisolerend\s*paneel\s*hoogwaardig|hoogwaardig\s*paneel/.test(text)) return 'glass_panel_high';
  if (/\bisolerend\s*paneel|glaspaneel|paneelisolatie/.test(text)) return 'glass_panel_low';
  if (/\bisolerende\s*deur\s*hoogwaardig|hoogwaardige\s*deur/.test(text)) return 'insulated_door_high';
  if (/\bisolerende\s*deur|geisoleerde\s*deur|geïsoleerde\s*deur/.test(text)) return 'insulated_door_low';
  if (/\bspouw/.test(text)) return 'cavity_wall';
  if (/\bdak/.test(text)) return 'roof';
  if (/\bvloer/.test(text)) return 'floor';
  if (/\bgevel/.test(text)) return 'facade';
  return null;
}

function detectAreaM2(quantity: string, text: string): number {
  const quantityValue = parseQuantityNumber(quantity);
  if (Number.isFinite(quantityValue) && quantityValue > 0 && /m2|m²/i.test(quantity)) {
    return quantityValue;
  }

  const areaInText = AREA_PATTERN.exec(text)?.[1];
  if (areaInText) {
    const parsed = Number.parseFloat(areaInText.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (Number.isFinite(quantityValue) && quantityValue > 0 && quantityValue !== 1) {
    return quantityValue;
  }

  return 20;
}

function normalizeSubsidyMeasureForType(
  row: SubsidyMeasureDraft,
  previousMeasureId?: ISDEMeasureID,
): SubsidyMeasureDraft {
  const performanceKindChanged =
    previousMeasureId != null &&
    measurePerformanceKind(previousMeasureId) !== measurePerformanceKind(row.measureId);
  const nextRow: SubsidyMeasureDraft = {
    ...row,
    performanceValue:
      performanceKindChanged || row.performanceValue == null
        ? defaultPerformanceValueForMeasure(row.measureId)
        : row.performanceValue,
    hasMKIBonus: measureSupportsMKI(row.measureId) ? row.hasMKIBonus : false,
    stackedWithPairedMeasure: measureSupportsPairStacking(row.measureId)
      ? row.stackedWithPairedMeasure
      : false,
    frameReplaced: measureNeedsFrameFields(row.measureId) ? row.frameReplaced : false,
  };

  if (!measureNeedsFrameFields(row.measureId)) {
    delete nextRow.framePerformanceValue;
  }

  return nextRow;
}

function measurePerformanceKind(measureId: ISDEMeasureID): 'rd' | 'u' {
  switch (measureId) {
    case 'hr_plus_plus':
    case 'triple_glass':
    case 'vacuum_glass':
    case 'glass_panel_low':
    case 'glass_panel_high':
    case 'insulated_door_low':
    case 'insulated_door_high':
      return 'u';
    default:
      return 'rd';
  }
}

function defaultPerformanceValueForMeasure(measureId: ISDEMeasureID): number {
  switch (measureId) {
    case 'cavity_wall':
      return 1.1;
    case 'hr_plus_plus':
    case 'glass_panel_low':
      return 1.1;
    case 'triple_glass':
    case 'vacuum_glass':
    case 'glass_panel_high':
      return 0.7;
    case 'insulated_door_low':
      return 1.5;
    case 'insulated_door_high':
      return 1;
    default:
      return 3.5;
  }
}

function setOptionalMeasureNumber(
  row: SubsidyMeasureDraft,
  field: 'performanceValue' | 'framePerformanceValue',
  value: EditableSubsidyValue,
): SubsidyMeasureDraft {
  const parsed = parseOptionalNumber(value);
  if (parsed != null) {
    return { ...row, [field]: parsed } as SubsidyMeasureDraft;
  }

  const nextRow = { ...row };
  delete nextRow[field];
  return nextRow;
}

function setOptionalInstallationNumber(
  row: SubsidyInstallationDraft,
  field: 'thermalPowerKW' | 'refrigerantChargeKg' | 'refrigerantGWP',
  value: EditableSubsidyValue,
): SubsidyInstallationDraft {
  const parsed = parseOptionalNumber(value);
  if (parsed != null) {
    return { ...row, [field]: parsed } as SubsidyInstallationDraft;
  }

  const nextRow = { ...row };
  delete nextRow[field];
  return nextRow;
}

function parseOptionalNumber(value: EditableSubsidyValue): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}