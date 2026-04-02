import { ChangeDetectionStrategy, Component, model, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type StepSchema, type OptionSchema, type InputMap, type InputValue,
  type OutputMap, type OutputAction, type OutputValueSource,
  STEP_TYPES, INPUT_SOURCE_TYPES, OUTPUT_SOURCE_TYPES,
} from '../flow-builder.types';
import { ConditionEditorComponent } from '../condition-editor/condition-editor.component';

@Component({
  selector: 'app-step-editor',
  imports: [FormsModule, ConditionEditorComponent],
  templateUrl: './step-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepEditorComponent {
  step = model.required<StepSchema>();

  protected readonly stepTypes = STEP_TYPES;
  protected readonly inputSourceTypes = INPUT_SOURCE_TYPES;
  protected readonly outputSourceTypes = OUTPUT_SOURCE_TYPES;

  protected readonly activeTab = signal<'general' | 'options' | 'conditions' | 'input' | 'output'>('general');

  protected readonly hasOptions = computed(() => {
    const type = this.step().type;
    return STEP_TYPES.find(t => t.value === type)?.hasOptions ?? true;
  });

  // ── General field setters ──────────────────────────────────────────────────

  protected updateField<K extends keyof StepSchema>(key: K, value: StepSchema[K]): void {
    this.step.set({ ...this.step(), [key]: value });
  }

  // ── Options management ──────────────────────────────────────────────────────

  protected getOptions(): OptionSchema[] {
    return [...(this.step().options ?? [])];
  }

  protected addOption(): void {
    const opts = this.getOptions();
    const id = `option-${Date.now().toString(36)}`;
    opts.push({ id, label: '', available: true });
    this.updateField('options', opts);
  }

  protected removeOption(idx: number): void {
    const opts = this.getOptions();
    opts.splice(idx, 1);
    this.updateField('options', opts);
  }

  protected updateOption(idx: number, key: keyof OptionSchema, value: unknown): void {
    const opts = this.getOptions();
    const existing = opts[idx];
    if (!existing) return;
    opts[idx] = Object.assign({}, existing, { [key]: value }); // NOSONAR — Object.assign needed for exactOptionalPropertyTypes
    this.updateField('options', opts);
  }

  protected moveOption(idx: number, direction: -1 | 1): void {
    const opts = this.getOptions();
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= opts.length) return;
    const a = opts[idx];
    const b = opts[newIdx];
    if (!a || !b) return;
    opts[idx] = b;
    opts[newIdx] = a;
    this.updateField('options', opts);
  }

  // ── Input map management ────────────────────────────────────────────────────

  protected getInputEntries(): Array<{ key: string; value: InputValue }> {
    return Object.entries(this.step().inputMap).map(([key, value]) => ({ key, value }));
  }

  protected getInputSourceType(val: InputValue): string {
    if ('$literal' in val) return '$literal';
    if ('$draft' in val) return '$draft';
    if ('$meta' in val) return '$meta';
    if ('$stepOptions' in val) return '$stepOptions';
    if ('$stepField' in val) return '$stepField';
    return '$literal';
  }

  protected getInputSourceValue(val: InputValue): string {
    if ('$literal' in val) return typeof val.$literal === 'string' ? val.$literal : JSON.stringify(val.$literal);
    if ('$draft' in val) return val.$draft;
    if ('$meta' in val) return val.$meta;
    if ('$stepField' in val) return val.$stepField;
    return '';
  }

  protected addInputEntry(): void {
    const map = { ...this.step().inputMap };
    const key = `input${Object.keys(map).length + 1}`;
    map[key] = { $literal: '' };
    this.updateField('inputMap', map);
  }

  protected removeInputEntry(key: string): void {
    const map = { ...this.step().inputMap };
    delete map[key];
    this.updateField('inputMap', map);
  }

  protected updateInputKey(oldKey: string, newKey: string): void {
    if (oldKey === newKey) return;
    const entries = Object.entries(this.step().inputMap);
    const map: InputMap = {};
    for (const [k, v] of entries) {
      map[k === oldKey ? newKey : k] = v;
    }
    this.updateField('inputMap', map);
  }

  protected updateInputSourceType(key: string, sourceType: string): void {
    const map = { ...this.step().inputMap };
    switch (sourceType) {
      case '$literal': map[key] = { $literal: '' }; break;
      case '$draft': map[key] = { $draft: '' }; break;
      case '$meta': map[key] = { $meta: 'stepNumber' }; break;
      case '$stepOptions': map[key] = { $stepOptions: true }; break;
      case '$stepField': map[key] = { $stepField: 'title' }; break;
    }
    this.updateField('inputMap', map);
  }

  protected updateInputSourceValue(key: string, value: string): void {
    const map = { ...this.step().inputMap };
    const current = map[key];
    if (!current) return;
    if ('$literal' in current) map[key] = { $literal: value };
    else if ('$draft' in current) map[key] = { $draft: value };
    else if ('$meta' in current) map[key] = { $meta: value as 'stepNumber' | 'totalSteps' };
    else if ('$stepField' in current) map[key] = { $stepField: value as 'title' | 'description' | 'type' };
    this.updateField('inputMap', map);
  }

  // ── Output map management ──────────────────────────────────────────────────

  protected getOutputEntries(): Array<{ eventName: string; action: OutputAction }> {
    return Object.entries(this.step().outputMap).map(([eventName, action]) => ({ eventName, action }));
  }

  protected addOutputEntry(): void {
    const map = { ...this.step().outputMap };
    const name = `event${Object.keys(map).length + 1}`;
    map[name] = { patchDraft: {} };
    this.updateField('outputMap', map);
  }

  protected removeOutputEntry(eventName: string): void {
    const map = { ...this.step().outputMap };
    delete map[eventName];
    this.updateField('outputMap', map);
  }

  protected updateOutputEventName(oldName: string, newName: string): void {
    if (oldName === newName) return;
    const entries = Object.entries(this.step().outputMap);
    const map: OutputMap = {};
    for (const [k, v] of entries) {
      map[k === oldName ? newName : k] = v;
    }
    this.updateField('outputMap', map);
  }

  protected getResetFieldsStr(action: OutputAction): string {
    return (action.resetFields ?? []).join(', ');
  }

  protected setResetFields(eventName: string, raw: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    action.resetFields = raw.split(',').map(v => v.trim()).filter(Boolean);
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected getPatchDraftEntries(action: OutputAction): Array<{ field: string; source: OutputValueSource }> {
    return Object.entries(action.patchDraft ?? {}).map(([field, source]) => ({ field, source }));
  }

  protected getOutputSourceType(source: OutputValueSource): string {
    if ('$value' in source) return '$value';
    if ('$literal' in source) return '$literal';
    if ('$valueField' in source) return '$valueField';
    return '$value';
  }

  protected getOutputSourceValue(source: OutputValueSource): string {
    if ('$literal' in source) return this.stringifyUnknown(source.$literal);
    if ('$valueField' in source) return source.$valueField;
    return '';
  }

  protected addPatchDraftField(eventName: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    const patch = action.patchDraft ? { ...action.patchDraft } : {};
    const field = `field${Object.keys(patch).length + 1}`;
    patch[field] = { $value: true };
    action.patchDraft = patch;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected removePatchDraftField(eventName: string, field: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    const patch = action.patchDraft ? { ...action.patchDraft } : {};
    delete patch[field];
    action.patchDraft = patch;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected updatePatchDraftFieldName(eventName: string, oldField: string, newField: string): void {
    if (oldField === newField) return;
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    const entries = action.patchDraft ? Object.entries(action.patchDraft) : [];
    const patch: Record<string, OutputValueSource> = {};
    for (const [k, v] of entries) {
      patch[k === oldField ? newField : k] = v;
    }
    action.patchDraft = patch;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected updatePatchDraftSourceType(eventName: string, field: string, sourceType: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    const patch = action.patchDraft ? { ...action.patchDraft } : {};
    switch (sourceType) {
      case '$value': patch[field] = { $value: true }; break;
      case '$literal': patch[field] = { $literal: '' }; break;
      case '$valueField': patch[field] = { $valueField: '' }; break;
    }
    action.patchDraft = patch;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected updatePatchDraftSourceValue(eventName: string, field: string, value: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    const patch = action.patchDraft ? { ...action.patchDraft } : {};
    const current = patch[field];
    if (!current) return;
    if ('$literal' in current) patch[field] = { $literal: value };
    else if ('$valueField' in current) patch[field] = { $valueField: value };
    action.patchDraft = patch;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  protected toggleMediaFiles(eventName: string): void {
    const map = { ...this.step().outputMap };
    const action = { ...map[eventName] };
    action.mediaFiles = !action.mediaFiles;
    map[eventName] = action;
    this.updateField('outputMap', map);
  }

  private stringifyUnknown(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return `${value}`;
    if (typeof value === 'symbol') return value.description ? `Symbol(${value.description})` : 'Symbol()';
    if (typeof value === 'function') return value.name ? `[Function ${value.name}]` : '[Function]';
    if (value instanceof Date) return value.toISOString();

    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '[Unserializable Object]';
    }
  }
}
