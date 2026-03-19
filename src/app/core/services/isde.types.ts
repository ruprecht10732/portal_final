export interface RequestedMeasure {
  measureId: string;
  areaM2: number;
  performanceValue?: number;
  framePerformanceValue?: number;
  hasMKIBonus?: boolean;
  frameReplaced?: boolean;
  stackedWithPairedMeasure?: boolean;
}

export interface RequestedInstallation {
  kind?: 'meldcode' | 'ventilation' | 'heat_pump' | 'warmtenet' | 'electric_cooking';
  meldcode?: string;
  heatPumpType?: 'air_water' | 'ground_water' | 'water_water' | 'heat_pump_boiler';
  heatPumpEnergyLabel?: string;
  thermalPowerKW?: number;
  isAdditionalUnit?: boolean;
  isSplitSystem?: boolean;
  refrigerantChargeKg?: number;
  refrigerantGWP?: number;
}

export interface ISDECalculationRequest {
  executionYear?: number;
  previousSubsidiesWithin24Months: boolean;
  hasExistingWarmtenetConnection?: boolean;
  hasReceivedWarmtenetSubsidy?: boolean;
  measures: RequestedMeasure[];
  installations: RequestedInstallation[];
}

export interface ISDELineItem {
  description: string;
  areaM2?: number;
  amountCents: number;
}

export interface ISDECalculationResponse {
  totalAmountCents: number;
  isDoubled: boolean;
  eligibleMeasureCount: number;
  insulationBreakdown: ISDELineItem[];
  glassBreakdown: ISDELineItem[];
  installations: ISDELineItem[];
  validationMessages?: string[];
  unknownMeasureIds?: string[];
  unknownMeldcodes?: string[];
}