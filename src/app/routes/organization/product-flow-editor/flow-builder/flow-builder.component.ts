import { ChangeDetectionStrategy, Component, model, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  type FlowDefinition, type StepSchema,
  createEmptyStep,
} from './flow-builder.types';
import { StepCardComponent } from './step-card/step-card.component';
import { StepSettingsPanelComponent } from './step-settings-panel/step-settings-panel.component';
import { FlowSettingsDialogComponent } from './flow-settings-dialog/flow-settings-dialog.component';
import { FlowPreviewSimulatorComponent } from './flow-preview/flow-preview-simulator.component';

@Component({
  selector: 'app-flow-builder',
  imports: [
    FormsModule, CdkDrag, CdkDropList,
    StepCardComponent, StepSettingsPanelComponent,
    FlowSettingsDialogComponent, FlowPreviewSimulatorComponent,
  ],
  templateUrl: './flow-builder.component.html',
  styleUrl: './flow-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowBuilderComponent {
  definition = model.required<FlowDefinition>();

  protected readonly showPreview = signal(false);
  protected readonly showSettings = signal(false);
  protected readonly settingsStepIndex = signal<number | null>(null);
  protected readonly jsonEdit = signal('');
  protected readonly jsonError = signal<string | null>(null);
  protected readonly showJson = signal(false);

  /** Collect ALL draftFields across the entire flow for condition suggestions. */
  protected readonly allDraftFields = computed(() => {
    const fields: string[] = [];
    for (const s of this.definition().steps) {
      for (const inp of s.inputs) {
        if (inp.draftField) fields.push(inp.draftField);
      }
    }
    return [...new Set(fields)];
  });

  protected readonly settingsStep = computed<StepSchema | null>(() => {
    const idx = this.settingsStepIndex();
    if (idx === null) return null;
    return this.definition().steps[idx] ?? null;
  });

  // ── Steps management ───────────────────────────────────────────────────────

  protected addStep(): void {
    const def = this.definition();
    this.definition.set({ ...def, steps: [...def.steps, createEmptyStep()] });
  }

  protected duplicateStep(idx: number): void {
    const def = this.definition();
    const original = def.steps[idx];
    if (!original) return;
    const copy: StepSchema = {
      ...structuredClone(original),
      id: `step-${Date.now().toString(36)}`,
      title: `${original.title} (kopie)`,
    };
    const steps = [...def.steps];
    steps.splice(idx + 1, 0, copy);
    this.definition.set({ ...def, steps });
  }

  protected removeStep(idx: number): void {
    const def = this.definition();
    this.definition.set({ ...def, steps: def.steps.filter((_, i) => i !== idx) });
  }

  protected onStepDrop(event: CdkDragDrop<StepSchema[]>): void {
    const def = this.definition();
    const steps = [...def.steps];
    moveItemInArray(steps, event.previousIndex, event.currentIndex);
    this.definition.set({ ...def, steps });
  }

  protected updateStep(idx: number, step: StepSchema): void {
    const def = this.definition();
    const steps = [...def.steps];
    steps[idx] = step;
    this.definition.set({ ...def, steps });
  }

  protected openStepSettings(idx: number): void {
    this.settingsStepIndex.set(idx);
  }

  protected closeStepSettings(): void {
    this.settingsStepIndex.set(null);
  }

  protected updateSettingsStep(step: StepSchema): void {
    const idx = this.settingsStepIndex();
    if (idx === null) return;
    this.updateStep(idx, step);
  }

  // ── Flow settings ─────────────────────────────────────────────────────────

  protected updateSettings(settings: FlowDefinition['settings']): void {
    this.definition.set({ ...this.definition(), settings });
  }

  // ── JSON editor ───────────────────────────────────────────────────────────

  protected toggleJson(): void {
    const next = !this.showJson();
    this.showJson.set(next);
    if (next) {
      this.jsonEdit.set(JSON.stringify(this.definition(), null, 2));
      this.jsonError.set(null);
    }
  }

  protected applyJson(): void {
    try {
      const parsed = JSON.parse(this.jsonEdit());
      this.definition.set(parsed);
      this.jsonError.set(null);
    } catch (e) {
      this.jsonError.set('Ongeldige JSON: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
}
