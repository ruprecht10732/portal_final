// ── Conditions ──────────────────────────────────────────────────────────────
export type FieldCondition =
  | { op: 'truthy'; field: string }
  | { op: 'falsy'; field: string }
  | { op: 'eq'; field: string; value: unknown }
  | { op: 'neq'; field: string; value: unknown }
  | { op: 'in'; field: string; values: unknown[] }
  | { op: 'not_in'; field: string; values: unknown[] };

export type CompoundCondition =
  | { op: 'and'; conditions: Condition[] }
  | { op: 'or'; conditions: Condition[] }
  | { op: 'not'; condition: Condition };

export type Condition = FieldCondition | CompoundCondition;

// ── Options ──────────────────────────────────────────────────────────────
export interface OptionSchema {
  id: string;
  label: string;
  description?: string;
  imagePath?: string;
  available?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Input mapping ────────────────────────────────────────────────────────────
export type InputValue =
  | { $literal: unknown }
  | { $draft: string }
  | { $meta: 'stepNumber' | 'totalSteps' }
  | { $stepOptions: true }
  | { $stepField: 'title' | 'description' | 'type' };

export type InputMap = Record<string, InputValue>;

// ── Output mapping ───────────────────────────────────────────────────────────
export type OutputValueSource =
  | { $value: true }
  | { $literal: unknown }
  | { $valueField: string };

export interface OutputAction {
  patchDraft?: Record<string, OutputValueSource>;
  resetFields?: string[];
  mediaFiles?: boolean;
}

export type OutputMap = Record<string, OutputAction>;

// ── Review template ──────────────────────────────────────────────────────────
export interface ReviewItemTemplate {
  label: string;
  source:
    | { $draft: string; format?: 'mm' | 'boolean' | 'option-label'; stepId?: string }
    | { $literal: string };
}

export interface ReviewSectionTemplate {
  title: string;
  editStepId: string;
  visibleWhen?: Condition | null;
  items: ReviewItemTemplate[];
}

// ── Payload schema ───────────────────────────────────────────────────────────
export interface PayloadMeasurementFieldSchema {
  key: string;
  label: string;
  unit: string;
  draftField: string;
  conditionalKey?: { condition: Condition; alternateKey: string };
  conditionalLabel?: { condition: Condition; alternateLabel: string };
}

export interface PayloadSchema {
  productGroup: string;
  categoryField: string;
  categoryLabelFallback: string;
  frameOptionField?: string;
  frameOptionLabelFallback?: string;
  productTypeField?: string;
  productTypeLabelFallback?: string;
  supplierField?: string;
  supplierLabelFallback?: string;
  measurementFields: PayloadMeasurementFieldSchema[];
  measurementVisibleWhen?: Condition | null;
  preferencesSchema?: {
    customerWishesField: string;
    examplePreferenceField: string;
    exampleNotesField: string;
  };
}

// ── Step schema ──────────────────────────────────────────────────────────────
export interface StepSchema {
  id: string;
  type: string;
  title: string;
  description?: string;
  options?: OptionSchema[];
  visibleWhen: Condition | null;
  completeWhen: Condition | null;
  autoAdvance?: boolean;
  inputMap: InputMap;
  outputMap: OutputMap;
}

// ── Flow definition (root) ───────────────────────────────────────────────────
export interface FlowDefinition {
  steps: StepSchema[];
  reviewTemplate: ReviewSectionTemplate[];
  payloadSchema: PayloadSchema;
}

// ── Known step types ─────────────────────────────────────────────────────────
export const STEP_TYPES = [
  { value: 'single-select-grid', label: 'Grid keuze', description: 'Klant kiest 1 optie uit een raster van afbeeldingen', icon: '▦', hasOptions: true },
  { value: 'single-select-cards', label: 'Kaart keuze', description: 'Klant kiest 1 optie uit een lijst met kaarten', icon: '▤', hasOptions: true },
  { value: 'measurements-door', label: 'Deur opmeten', description: 'Meetformulier voor deurmaten', icon: '📐', hasOptions: false },
  { value: 'preferences-door', label: 'Deur voorkeur', description: 'Klant geeft deurstijtl voorkeuren aan', icon: '🚪', hasOptions: false },
  { value: 'media-upload', label: 'Foto\'s uploaden', description: 'Klant uploadt foto\'s of bestanden', icon: '📷', hasOptions: false },
  { value: 'review-summary', label: 'Samenvatting', description: 'Overzicht van alle ingevulde gegevens', icon: '✅', hasOptions: false },
  { value: 'kozijn-preset', label: 'Kozijn type', description: 'Klant kiest een kozijntype uit voorinstellingen', icon: '🪟', hasOptions: true },
  { value: 'kozijn-dimensions', label: 'Kozijn opmeten', description: 'Meetformulier voor kozijnmaten', icon: '📏', hasOptions: false },
  { value: 'kozijn-specs', label: 'Kozijn details', description: 'Technische specificaties van het kozijn', icon: '⚙️', hasOptions: false },
] as const;

export const CONDITION_OPERATORS = [
  { value: 'truthy', label: 'Is ingevuld', fields: ['field'] },
  { value: 'falsy', label: 'Is niet ingevuld', fields: ['field'] },
  { value: 'eq', label: 'Is gelijk aan', fields: ['field', 'value'] },
  { value: 'neq', label: 'Is niet gelijk aan', fields: ['field', 'value'] },
  { value: 'in', label: 'Is één van', fields: ['field', 'values'] },
  { value: 'not_in', label: 'Is geen van', fields: ['field', 'values'] },
  { value: 'and', label: 'Alle waar (EN)', fields: ['conditions'] },
  { value: 'or', label: 'Eén waar (OF)', fields: ['conditions'] },
  { value: 'not', label: 'Niet (omgekeerd)', fields: ['condition'] },
] as const;

export const INPUT_SOURCE_TYPES = [
  { value: '$literal', label: 'Vaste waarde' },
  { value: '$draft', label: 'Concept veld' },
  { value: '$meta', label: 'Stap info' },
  { value: '$stepOptions', label: 'Stap keuzes' },
  { value: '$stepField', label: 'Stap eigenschap' },
] as const;

export const OUTPUT_SOURCE_TYPES = [
  { value: '$value', label: 'Gekozen waarde' },
  { value: '$literal', label: 'Vaste waarde' },
  { value: '$valueField', label: 'Veld uit waarde' },
] as const;
