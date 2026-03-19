import type { CreateQuoteFeedbackRequest, TaxRateDisplay } from '../../../core/services/quotes.types';

export interface LineItemDraft {
  id: string;
  title: string;
  description: string;
  quantity: string;
  unitPrice: number | null;
  taxRate: TaxRateDisplay;
  optional: boolean;
  catalogProductId?: string;
  parentLineItemId?: string;
}

export interface QuoteFeedbackDiff {
  fieldChanged: CreateQuoteFeedbackRequest['fieldChanged'];
  aiValue: Record<string, unknown>;
  humanValue: Record<string, unknown>;
}

export interface UrlDraft {
  uid: string;
  label: string;
  href: string;
  catalogProductId?: string;
}

export type ISDEMeasureID =
  | 'roof'
  | 'attic'
  | 'facade'
  | 'cavity_wall'
  | 'floor'
  | 'crawl_space'
  | 'hr_plus_plus'
  | 'triple_glass'
  | 'vacuum_glass'
  | 'glass_panel_low'
  | 'glass_panel_high'
  | 'insulated_door_low'
  | 'insulated_door_high';

export type ISDEInstallationKind =
  | 'meldcode'
  | 'ventilation'
  | 'heat_pump'
  | 'warmtenet'
  | 'electric_cooking';

export interface SubsidyMeasureDraft {
  uid: string;
  measureId: ISDEMeasureID;
  areaM2: number;
  performanceValue?: number;
  framePerformanceValue?: number;
  hasMKIBonus: boolean;
  frameReplaced: boolean;
  stackedWithPairedMeasure: boolean;
}

export interface SubsidyInstallationDraft {
  uid: string;
  kind: ISDEInstallationKind;
  meldcode: string;
  heatPumpType: 'air_water' | 'ground_water' | 'water_water' | 'heat_pump_boiler';
  heatPumpEnergyLabel: 'A++' | 'A+++';
  thermalPowerKW?: number;
  isAdditionalUnit: boolean;
  isSplitSystem: boolean;
  refrigerantChargeKg?: number;
  refrigerantGWP?: number;
}

export interface ISDEMeasureOption {
  value: ISDEMeasureID;
  label: string;
  performanceLabel: string;
}

export type EditableSubsidyMeasureField =
  | 'measureId'
  | 'areaM2'
  | 'performanceValue'
  | 'framePerformanceValue'
  | 'hasMKIBonus'
  | 'frameReplaced'
  | 'stackedWithPairedMeasure';

export type EditableSubsidyInstallationField =
  | 'kind'
  | 'meldcode'
  | 'heatPumpType'
  | 'heatPumpEnergyLabel'
  | 'thermalPowerKW'
  | 'isAdditionalUnit'
  | 'isSplitSystem'
  | 'refrigerantChargeKg'
  | 'refrigerantGWP';

export type EditableSubsidyValue = string | number | boolean | null;