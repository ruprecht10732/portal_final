import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import {
  type InputFieldSchema, type InputFieldOption, type Condition,
  getInputFieldType,
} from '../flow-builder.types';
import { ConditionEditorComponent } from '../condition-editor/condition-editor.component';

@Component({
  selector: 'app-input-field-editor',
  imports: [FormsModule, CdkDragHandle, ConditionEditorComponent],
  templateUrl: './input-field-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputFieldEditorComponent {
  field = model.required<InputFieldSchema>();
  availableDraftFields = input<string[]>([]);
  remove = output<void>();

  protected readonly expanded = signal(false);

  protected readonly typeDef = computed(() => getInputFieldType(this.field().type));
  protected readonly hasOptions = computed(() => this.typeDef()?.hasOptions ?? false);
  protected readonly typeIcon = computed(() => this.typeDef()?.icon ?? '?');
  protected readonly typeLabel = computed(() => this.typeDef()?.label ?? this.field().type);

  protected toggle(): void {
    this.expanded.update(v => !v);
  }

  protected updateField<K extends keyof InputFieldSchema>(key: K, value: InputFieldSchema[K]): void {
    this.field.set({ ...this.field(), [key]: value });
  }

  protected updateVisibleWhen(condition: Condition | null): void {
    this.field.set({ ...this.field(), visibleWhen: condition });
  }

  // ── Options management ──────────────────────────────────────────────────
  protected addOption(): void {
    const f = this.field();
    const options = [...(f.options ?? [])];
    options.push({
      id: `opt-${Date.now().toString(36)}`,
      label: '',
    });
    this.field.set({ ...f, options });
  }

  protected removeOption(idx: number): void {
    const f = this.field();
    const options = (f.options ?? []).filter((_, i) => i !== idx);
    this.field.set({ ...f, options });
  }

  protected updateOption(idx: number, key: keyof InputFieldOption, value: string): void {
    const f = this.field();
    const options = [...(f.options ?? [])];
    const existing = options[idx];
    if (!existing) return;
    options[idx] = { ...existing, [key]: value };
    this.field.set({ ...f, options });
  }
}
