import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type Condition, type GoToRule, type StepSchema } from '../flow-builder.types';
import { ConditionEditorComponent } from '../condition-editor/condition-editor.component';

@Component({
  selector: 'app-go-to-rule-editor',
  imports: [FormsModule, ConditionEditorComponent],
  templateUrl: './go-to-rule-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoToRuleEditorComponent {
  rule = model.required<GoToRule>();
  steps = input.required<StepSchema[]>();
  currentStepId = input.required<string>();
  draftFieldSuggestions = input<string[]>([]);
  remove = output<void>();

  protected readonly availableTargets = computed(() =>
    this.steps().filter(s => s.id !== this.currentStepId()),
  );

  protected updateCondition(condition: Condition | null): void {
    if (condition) {
      this.rule.set({ ...this.rule(), condition });
    }
  }

  protected updateTargetStepId(targetStepId: string): void {
    this.rule.set({ ...this.rule(), targetStepId });
  }

  protected updateLabel(label: string): void {
    const current = this.rule();
    if (label) {
      this.rule.set({ ...current, label });
    } else {
      const { label: _, ...rest } = current;
      this.rule.set(rest as GoToRule);
    }
  }
}
