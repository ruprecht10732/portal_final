// ── Conditions (kept from V1 — these are solid) ─────────────────────────────
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

// ── Input field types ────────────────────────────────────────────────────────
export type InputFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'image-select'
  | 'file-upload'
  | 'date';

export interface InputFieldOption {
  id: string;
  label: string;
  description?: string;
  imagePath?: string;
  available?: boolean;
}

export interface InputFieldSchema {
  id: string;
  type: InputFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  visibleWhen: Condition | null;
  draftField: string;

  // Type-specific config (only relevant fields used per type)
  options?: InputFieldOption[];       // radio, select, checkbox, image-select
  min?: number;                       // number
  max?: number;                       // number
  step?: number;                      // number
  unit?: string;                      // number (mm, cm, m)
  accept?: string;                    // file-upload (e.g., "image/*")
  multiple?: boolean;                 // file-upload, select
  rows?: number;                      // textarea
}

// ── Go-to (skip) rules ───────────────────────────────────────────────────────
export interface GoToRule {
  condition: Condition;
  targetStepId: string;
  label?: string;
}

// ── Step presets ─────────────────────────────────────────────────────────────
export type StepPreset = 'technical-drawing';

export interface DrawingMeasurementField {
  id: string;
  label: string;
  unit: string;
  draftField: string;
  positions?: string[];               // e.g., ['top', 'middle', 'bottom']
}

export interface TechnicalDrawingConfig {
  drawingType: 'wooden-frame';
  measurementFields: DrawingMeasurementField[];
}

// ── Step schema (V2) ─────────────────────────────────────────────────────────
export interface StepSchema {
  id: string;
  title: string;
  description?: string;
  visibleWhen: Condition | null;
  inputs: InputFieldSchema[];
  goToRules: GoToRule[];
  preset: StepPreset | null;
  technicalDrawingConfig?: TechnicalDrawingConfig;
}

// ── Flow settings ────────────────────────────────────────────────────────────
export interface FlowSettings {
  productGroup: string;
  summaryTitle: string;
  summaryDescription?: string;
}

// ── Flow definition V2 (root) ────────────────────────────────────────────────
export interface FlowDefinition {
  version: 2;
  steps: StepSchema[];
  settings: FlowSettings;
}

// ── Input field type palette ─────────────────────────────────────────────────
export interface InputFieldTypeDefinition {
  value: InputFieldType;
  label: string;
  description: string;
  icon: string;
  category: 'tekst' | 'keuze' | 'media' | 'overig';
  hasOptions: boolean;
}

export interface InputFieldTypeCategory {
  id: 'tekst' | 'keuze' | 'media' | 'overig';
  label: string;
  icon: string;
}

export const INPUT_FIELD_CATEGORIES: readonly InputFieldTypeCategory[] = [
  { id: 'tekst', label: 'Tekst & Getallen', icon: '✏️' },
  { id: 'keuze', label: 'Keuze', icon: '☰' },
  { id: 'media', label: 'Media', icon: '📷' },
  { id: 'overig', label: 'Overig', icon: '📅' },
] as const;

export const INPUT_FIELD_TYPES: readonly InputFieldTypeDefinition[] = [
  // ─── Tekst & Getallen ──────────────────────────────────────────
  { value: 'text', label: 'Tekstveld', description: 'Kort tekstveld', icon: 'Aa', category: 'tekst', hasOptions: false },
  { value: 'textarea', label: 'Tekstvak', description: 'Groter tekstvak voor langere antwoorden', icon: '¶', category: 'tekst', hasOptions: false },
  { value: 'number', label: 'Getal', description: 'Numerieke invoer met optionele eenheid', icon: '#', category: 'tekst', hasOptions: false },
  // ─── Keuze ─────────────────────────────────────────────────────
  { value: 'radio', label: 'Keuzerondje', description: 'Eén optie selecteren', icon: '◉', category: 'keuze', hasOptions: true },
  { value: 'checkbox', label: 'Selectievak', description: 'Meerdere opties selecteren', icon: '☑', category: 'keuze', hasOptions: true },
  { value: 'select', label: 'Dropdown', description: 'Keuze uit een uitklaplijst', icon: '▾', category: 'keuze', hasOptions: true },
  { value: 'image-select', label: 'Afbeeldingskeuze', description: 'Selectie met afbeeldingen', icon: '🖼', category: 'keuze', hasOptions: true },
  // ─── Media ─────────────────────────────────────────────────────
  { value: 'file-upload', label: 'Bestand uploaden', description: 'Foto\'s of documenten toevoegen', icon: '📎', category: 'media', hasOptions: false },
  // ─── Overig ────────────────────────────────────────────────────
  { value: 'date', label: 'Datum', description: 'Datumkiezer', icon: '📅', category: 'overig', hasOptions: false },
] as const;

export const STEP_PRESETS: readonly { value: StepPreset; label: string; icon: string; description: string }[] = [
  { value: 'technical-drawing', label: 'Technische tekening', icon: '📐', description: 'Meetformulier met configureerbare meetvelden' },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getInputFieldType(value: InputFieldType): InputFieldTypeDefinition | undefined {
  return INPUT_FIELD_TYPES.find(t => t.value === value);
}

export function getInputFieldTypesByCategory(category: string): readonly InputFieldTypeDefinition[] {
  return INPUT_FIELD_TYPES.filter(t => t.category === category);
}

export function createEmptyStep(): StepSchema {
  return {
    id: `step-${Date.now().toString(36)}`,
    title: 'Nieuwe stap',
    visibleWhen: null,
    inputs: [],
    goToRules: [],
    preset: null,
  };
}

export function createEmptyInput(type: InputFieldType): InputFieldSchema {
  const typeDef = getInputFieldType(type);
  return {
    id: `input-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: typeDef?.label ?? type,
    required: false,
    visibleWhen: null,
    draftField: '',
    ...(typeDef?.hasOptions ? { options: [] } : {}),
    ...(type === 'textarea' ? { rows: 3 } : {}),
    ...(type === 'number' ? { unit: 'mm' } : {}),
    ...(type === 'file-upload' ? { accept: 'image/*', multiple: true } : {}),
  };
}

export function createEmptyDefinition(): FlowDefinition {
  return {
    version: 2,
    steps: [],
    settings: {
      productGroup: '',
      summaryTitle: 'Samenvatting',
    },
  };
}
