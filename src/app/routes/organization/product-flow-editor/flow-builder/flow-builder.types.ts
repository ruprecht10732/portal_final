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

// ── Element categories & palette ─────────────────────────────────────────────

export interface ElementTypeDefinition {
  value: string;
  label: string;
  description: string;
  icon: string;
  category: 'keuze' | 'invoer' | 'media' | 'weergave';
  hasOptions: boolean;
  /** Default output config when this element is added */
  defaultOutput: OutputMap;
  /** Default input config when this element is added */
  defaultInput: InputMap;
}

export interface ElementCategory {
  id: 'keuze' | 'invoer' | 'media' | 'weergave';
  label: string;
  icon: string;
  description: string;
}

export const ELEMENT_CATEGORIES: readonly ElementCategory[] = [
  { id: 'keuze', label: 'Keuze', icon: '☰', description: 'Klant maakt een selectie' },
  { id: 'invoer', label: 'Invoer', icon: '✏️', description: 'Klant vult gegevens in' },
  { id: 'media', label: 'Media', icon: '📷', description: 'Bestanden & foto\'s' },
  { id: 'weergave', label: 'Weergave', icon: '👁️', description: 'Informatie tonen' },
] as const;

export const ELEMENT_TYPES: readonly ElementTypeDefinition[] = [
  // ─── Keuze ────────────────────────────────────────────────────
  {
    value: 'single-select-grid',
    label: 'Keuzerooster',
    description: 'Keuze uit afbeeldingen in een raster',
    icon: '▦',
    category: 'keuze',
    hasOptions: true,
    defaultOutput: {
      select: { patchDraft: { categoryId: { $value: true } } },
    },
    defaultInput: {
      options: { $stepOptions: true },
      title: { $stepField: 'title' },
    },
  },
  {
    value: 'single-select-cards',
    label: 'Keuzekaarten',
    description: 'Keuze uit een lijst met beschrijvingen',
    icon: '▤',
    category: 'keuze',
    hasOptions: true,
    defaultOutput: {
      select: { patchDraft: { selectedOption: { $value: true } } },
    },
    defaultInput: {
      options: { $stepOptions: true },
      title: { $stepField: 'title' },
    },
  },
  // ─── Invoer ───────────────────────────────────────────────────
  {
    value: 'measurements-door',
    label: 'Meetformulier',
    description: 'Klant vult afmetingen in',
    icon: '📐',
    category: 'invoer',
    hasOptions: false,
    defaultOutput: {
      measure: { patchDraft: {} },
    },
    defaultInput: {
      title: { $stepField: 'title' },
    },
  },
  {
    value: 'preferences-door',
    label: 'Voorkeuren formulier',
    description: 'Klant geeft wensen en voorkeuren aan',
    icon: '📝',
    category: 'invoer',
    hasOptions: false,
    defaultOutput: {
      preferences: { patchDraft: {} },
    },
    defaultInput: {
      title: { $stepField: 'title' },
    },
  },
  {
    value: 'kozijn-dimensions',
    label: 'Afmetingen invoer',
    description: 'Gedetailleerd meetformulier met voorvertoning',
    icon: '📏',
    category: 'invoer',
    hasOptions: false,
    defaultOutput: {
      measure: { patchDraft: {} },
    },
    defaultInput: {
      title: { $stepField: 'title' },
    },
  },
  {
    value: 'kozijn-specs',
    label: 'Specificaties formulier',
    description: 'Technische details invullen',
    icon: '⚙️',
    category: 'invoer',
    hasOptions: false,
    defaultOutput: {
      specs: { patchDraft: {} },
    },
    defaultInput: {
      title: { $stepField: 'title' },
    },
  },
  {
    value: 'kozijn-preset',
    label: 'Preset keuze',
    description: 'Keuze uit voorinstellingen met afbeeldingen',
    icon: '🪟',
    category: 'keuze',
    hasOptions: true,
    defaultOutput: {
      select: { patchDraft: { presetId: { $value: true } } },
    },
    defaultInput: {
      options: { $stepOptions: true },
      title: { $stepField: 'title' },
    },
  },
  // ─── Media ────────────────────────────────────────────────────
  {
    value: 'media-upload',
    label: 'Bestanden uploaden',
    description: 'Foto\'s, documenten of video\'s toevoegen',
    icon: '📷',
    category: 'media',
    hasOptions: false,
    defaultOutput: {
      upload: { mediaFiles: true },
    },
    defaultInput: {
      title: { $stepField: 'title' },
      description: { $stepField: 'description' },
    },
  },
  // ─── Weergave ─────────────────────────────────────────────────
  {
    value: 'review-summary',
    label: 'Samenvatting',
    description: 'Overzicht van alle gegeven antwoorden',
    icon: '✅',
    category: 'weergave',
    hasOptions: false,
    defaultOutput: {},
    defaultInput: {
      title: { $stepField: 'title' },
    },
  },
] as const;

export function getElementType(value: string): ElementTypeDefinition | undefined {
  return ELEMENT_TYPES.find(t => t.value === value);
}

export function getElementsByCategory(category: string): readonly ElementTypeDefinition[] {
  return ELEMENT_TYPES.filter(t => t.category === category);
}

// ── Condition configuration ──────────────────────────────────────────────────

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
