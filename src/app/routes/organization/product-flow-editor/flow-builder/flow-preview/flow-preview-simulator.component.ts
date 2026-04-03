import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type FlowDefinition, type StepSchema, type InputFieldSchema, getInputFieldType } from '../flow-builder.types';
import { evaluateCondition } from './condition-evaluator';

@Component({
  selector: 'app-flow-preview-simulator',
  imports: [FormsModule],
  templateUrl: './flow-preview-simulator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowPreviewSimulatorComponent {
  definition = input.required<FlowDefinition>();

  protected readonly draft = signal<Record<string, unknown>>({});
  protected readonly currentStepIndex = signal(0);

  protected readonly visibleSteps = computed(() => {
    const d = this.draft();
    return this.definition().steps.filter(s => evaluateCondition(s.visibleWhen, d));
  });

  protected readonly currentStep = computed<StepSchema | null>(() => {
    const steps = this.visibleSteps();
    const idx = this.currentStepIndex();
    return steps[idx] ?? null;
  });

  protected readonly visibleInputs = computed<InputFieldSchema[]>(() => {
    const step = this.currentStep();
    if (!step) return [];
    const d = this.draft();
    return step.inputs.filter(inp => evaluateCondition(inp.visibleWhen, d));
  });

  protected readonly isFirst = computed(() => this.currentStepIndex() === 0);
  protected readonly isLast = computed(() => {
    const steps = this.visibleSteps();
    return this.currentStepIndex() >= steps.length - 1;
  });
  protected readonly isSummary = computed(() => {
    const steps = this.visibleSteps();
    return this.currentStepIndex() >= steps.length;
  });

  protected getIcon(inp: InputFieldSchema): string {
    return getInputFieldType(inp.type)?.icon ?? '?';
  }

  protected getDraftValue(field: string): unknown {
    return this.draft()[field] ?? '';
  }

  protected setDraftValue(field: string, value: unknown): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected toggleCheckboxValue(field: string, optionId: string): void {
    this.draft.update(d => {
      const current = (d[field] as string[] | undefined) ?? [];
      const next = current.includes(optionId)
        ? current.filter(v => v !== optionId)
        : [...current, optionId];
      return { ...d, [field]: next };
    });
  }

  protected isChecked(field: string, optionId: string): boolean {
    const val = this.draft()[field];
    return Array.isArray(val) && val.includes(optionId);
  }

  protected next(): void {
    const step = this.currentStep();
    if (step) {
      // Check go-to rules
      const d = this.draft();
      for (const rule of step.goToRules) {
        if (evaluateCondition(rule.condition, d)) {
          const targetIdx = this.visibleSteps().findIndex(s => s.id === rule.targetStepId);
          if (targetIdx >= 0) {
            this.currentStepIndex.set(targetIdx);
            return;
          }
        }
      }
    }
    this.currentStepIndex.update(i => i + 1);
  }

  protected prev(): void {
    this.currentStepIndex.update(i => Math.max(0, i - 1));
  }

  protected reset(): void {
    this.draft.set({});
    this.currentStepIndex.set(0);
  }

  protected getSummaryEntries(): { label: string; value: unknown }[] {
    const d = this.draft();
    const entries: { label: string; value: unknown }[] = [];
    for (const step of this.definition().steps) {
      for (const inp of step.inputs) {
        if (inp.draftField && d[inp.draftField] !== undefined && d[inp.draftField] !== '') {
          entries.push({ label: inp.label, value: d[inp.draftField] });
        }
      }
    }
    return entries;
  }
}
