import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type StepSchema, type GoToRule, type Condition,
  type DrawingMeasurementField, STEP_PRESETS,
} from '../flow-builder.types';
import { ConditionEditorComponent } from '../condition-editor/condition-editor.component';
import { GoToRuleEditorComponent } from '../go-to-rule-editor/go-to-rule-editor.component';

@Component({
  selector: 'app-step-settings-panel',
  imports: [FormsModule, ConditionEditorComponent, GoToRuleEditorComponent],
  templateUrl: './step-settings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepSettingsPanelComponent {
  step = model.required<StepSchema>();
  allSteps = input.required<StepSchema[]>();
  draftFieldSuggestions = input<string[]>([]);
  close = output<void>();

  protected readonly activeTab = signal<'conditions' | 'skip-logic' | 'preset'>('conditions');
  protected readonly presets = STEP_PRESETS;

  // ── Conditions tab ──
  protected updateVisibleWhen(condition: Condition | null): void {
    this.step.set({ ...this.step(), visibleWhen: condition });
  }

  // ── Skip logic tab ──
  protected addGoToRule(): void {
    const s = this.step();
    const rule: GoToRule = { condition: { op: 'truthy', field: '' }, targetStepId: '', label: '' };
    this.step.set({ ...s, goToRules: [...s.goToRules, rule] });
  }

  protected updateGoToRule(idx: number, rule: GoToRule): void {
    const s = this.step();
    const rules = [...s.goToRules];
    rules[idx] = rule;
    this.step.set({ ...s, goToRules: rules });
  }

  protected removeGoToRule(idx: number): void {
    const s = this.step();
    this.step.set({ ...s, goToRules: s.goToRules.filter((_, i) => i !== idx) });
  }

  // ── Preset tab ──
  protected togglePreset(enabled: boolean): void {
    const s = this.step();
    if (enabled) {
      this.step.set({
        ...s,
        preset: 'technical-drawing',
        technicalDrawingConfig: { drawingType: 'wooden-frame', measurementFields: [] },
      });
    } else {
      const { technicalDrawingConfig: _, ...rest } = s;
      this.step.set({ ...rest, preset: null });
    }
  }

  protected addMeasurementField(): void {
    const s = this.step();
    if (!s.technicalDrawingConfig) return;
    const field: DrawingMeasurementField = {
      id: `mf-${Date.now().toString(36)}`,
      label: 'Nieuw meetveld',
      unit: 'mm',
      draftField: '',
    };
    this.step.set({
      ...s,
      technicalDrawingConfig: {
        ...s.technicalDrawingConfig,
        measurementFields: [...s.technicalDrawingConfig.measurementFields, field],
      },
    });
  }

  protected updateMeasurementField(idx: number, partial: Partial<DrawingMeasurementField>): void {
    const s = this.step();
    if (!s.technicalDrawingConfig) return;
    const fields = [...s.technicalDrawingConfig.measurementFields];
    fields[idx] = { ...fields[idx], ...partial } as DrawingMeasurementField;
    this.step.set({
      ...s,
      technicalDrawingConfig: { ...s.technicalDrawingConfig, measurementFields: fields },
    });
  }

  protected removeMeasurementField(idx: number): void {
    const s = this.step();
    if (!s.technicalDrawingConfig) return;
    this.step.set({
      ...s,
      technicalDrawingConfig: {
        ...s.technicalDrawingConfig,
        measurementFields: s.technicalDrawingConfig.measurementFields.filter((_, i) => i !== idx),
      },
    });
  }
}
