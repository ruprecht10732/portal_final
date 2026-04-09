import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type Condition,
  type DrawingMeasurementField,
  type InputFieldSchema,
  type InputFieldType,
  type StepSchema,
  createEmptyInput,
  STEP_PRESETS,
} from '../flow-builder.types';
import { ConditionEditorComponent } from '../condition-editor/condition-editor.component';
import { InputFieldEditorComponent } from '../input-field-editor/input-field-editor.component';
import { InputTypePaletteComponent } from '../input-type-palette/input-type-palette.component';

@Component({
  selector: 'app-step-editor',
  imports: [FormsModule, ConditionEditorComponent, InputFieldEditorComponent, InputTypePaletteComponent],
  templateUrl: './step-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepEditorComponent {
  step = model.required<StepSchema>();
  availableDraftFields = input<string[]>([]);

  protected readonly presets = STEP_PRESETS;
  protected readonly activeTab = signal<'general' | 'inputs' | 'logic'>('general');
  protected readonly showPalette = signal(false);
  protected readonly idPrefix = `step-editor-${Math.random().toString(36).slice(2, 8)}`;

  protected inputId(suffix: string): string {
    return `${this.idPrefix}-${suffix}`;
  }

  protected updateField<K extends keyof StepSchema>(key: K, value: StepSchema[K]): void {
    this.step.set({ ...this.step(), [key]: value });
  }

  protected updateDescription(description: string): void {
    const current = this.step();
    if (description) {
      this.step.set({ ...current, description });
      return;
    }

    const { description: _description, ...rest } = current;
    this.step.set(rest as StepSchema);
  }

  protected togglePalette(): void {
    this.showPalette.update(v => !v);
  }

  protected addInput(type: InputFieldType): void {
    const current = this.step();
    this.step.set({ ...current, inputs: [...current.inputs, createEmptyInput(type)] });
    this.showPalette.set(false);
  }

  protected updateInput(idx: number, field: InputFieldSchema): void {
    const current = this.step();
    const inputs = [...current.inputs];
    if (!inputs[idx]) return;
    inputs[idx] = field;
    this.step.set({ ...current, inputs });
  }

  protected removeInput(idx: number): void {
    const current = this.step();
    this.step.set({
      ...current,
      inputs: current.inputs.filter((_, inputIndex) => inputIndex !== idx),
    });
  }

  protected updateVisibleWhen(condition: Condition | null): void {
    this.step.set({ ...this.step(), visibleWhen: condition });
  }

  protected selectPreset(preset: StepSchema['preset']): void {
    const current = this.step();
    if (preset === 'technical-drawing') {
      this.step.set({
        ...current,
        preset,
        technicalDrawingConfig: current.technicalDrawingConfig ?? { drawingType: 'wooden-frame', measurementFields: [] },
      });
      return;
    }

    const { technicalDrawingConfig: _technicalDrawingConfig, ...rest } = current;
    this.step.set({ ...rest, preset: null });
  }

  protected addMeasurementField(): void {
    const current = this.step();
    if (!current.technicalDrawingConfig) return;

    const field: DrawingMeasurementField = {
      id: `mf-${Date.now().toString(36)}`,
      label: 'Nieuw meetveld',
      unit: 'mm',
      draftField: '',
    };

    this.step.set({
      ...current,
      technicalDrawingConfig: {
        ...current.technicalDrawingConfig,
        measurementFields: [...current.technicalDrawingConfig.measurementFields, field],
      },
    });
  }

  protected updateMeasurementField(idx: number, partial: Partial<DrawingMeasurementField>): void {
    const current = this.step();
    if (!current.technicalDrawingConfig) return;

    const measurementFields = [...current.technicalDrawingConfig.measurementFields];
    const existing = measurementFields[idx];
    if (!existing) return;

    measurementFields[idx] = { ...existing, ...partial };
    this.step.set({
      ...current,
      technicalDrawingConfig: {
        ...current.technicalDrawingConfig,
        measurementFields,
      },
    });
  }

  protected removeMeasurementField(idx: number): void {
    const current = this.step();
    if (!current.technicalDrawingConfig) return;

    if (!current.technicalDrawingConfig.measurementFields[idx]) return;

    this.step.set({
      ...current,
      technicalDrawingConfig: {
        ...current.technicalDrawingConfig,
        measurementFields: current.technicalDrawingConfig.measurementFields.filter((_, fieldIndex) => fieldIndex !== idx),
      },
    });
  }
}
