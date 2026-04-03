import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  type StepSchema, type InputFieldType, type InputFieldSchema, type FlowDefinition,
  createEmptyInput, STEP_PRESETS,
} from '../flow-builder.types';
import { InputFieldEditorComponent } from '../input-field-editor/input-field-editor.component';
import { InputTypePaletteComponent } from '../input-type-palette/input-type-palette.component';

@Component({
  selector: 'app-step-card',
  imports: [FormsModule, CdkDrag, CdkDropList, CdkDragHandle, InputFieldEditorComponent, InputTypePaletteComponent],
  templateUrl: './step-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepCardComponent {
  step = model.required<StepSchema>();
  definition = input.required<FlowDefinition>();
  stepIndex = input.required<number>();
  duplicate = output<void>();
  remove = output<void>();
  openSettings = output<void>();

  protected readonly expanded = signal(true);
  protected readonly showPalette = signal(false);
  protected readonly presets = STEP_PRESETS;

  /** Collect all draftFields from previous steps and current step for condition suggestions. */
  protected readonly draftFieldSuggestions = computed(() => {
    const def = this.definition();
    const idx = this.stepIndex();
    const fields: string[] = [];
    for (let i = 0; i <= idx; i++) {
      const s = def.steps[i];
      if (s) {
        for (const inp of s.inputs) {
          if (inp.draftField) fields.push(inp.draftField);
        }
      }
    }
    return [...new Set(fields)];
  });

  protected toggleExpand(): void {
    this.expanded.update(v => !v);
  }

  protected togglePalette(): void {
    this.showPalette.update(v => !v);
  }

  protected updateTitle(title: string): void {
    this.step.set({ ...this.step(), title });
  }

  protected updateDescription(description: string): void {
    const current = this.step();
    if (description) {
      this.step.set({ ...current, description });
    } else {
      const { description: _, ...rest } = current;
      this.step.set(rest as StepSchema);
    }
  }

  protected addInput(type: InputFieldType): void {
    const current = this.step();
    this.step.set({ ...current, inputs: [...current.inputs, createEmptyInput(type)] });
    this.showPalette.set(false);
  }

  protected updateInput(idx: number, updated: InputFieldSchema): void {
    const current = this.step();
    const inputs = [...current.inputs];
    inputs[idx] = updated;
    this.step.set({ ...current, inputs });
  }

  protected removeInput(idx: number): void {
    const current = this.step();
    const inputs = current.inputs.filter((_, i) => i !== idx);
    this.step.set({ ...current, inputs });
  }

  protected dropInput(event: CdkDragDrop<InputFieldSchema[]>): void {
    const current = this.step();
    const inputs = [...current.inputs];
    moveItemInArray(inputs, event.previousIndex, event.currentIndex);
    this.step.set({ ...current, inputs });
  }

  protected get hasConditions(): boolean {
    return this.step().visibleWhen !== null || this.step().goToRules.length > 0;
  }

  protected get hasPreset(): boolean {
    return this.step().preset !== null;
  }
}
