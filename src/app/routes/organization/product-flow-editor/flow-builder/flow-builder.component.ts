import { ChangeDetectionStrategy, Component, model, computed, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { type FlowDefinition, type StepSchema, type ReviewSectionTemplate, type PayloadSchema, STEP_TYPES } from './flow-builder.types';
import { StepEditorComponent } from './step-editor/step-editor.component';
import { ConditionEditorComponent } from './condition-editor/condition-editor.component';

@Component({
  selector: 'app-flow-builder',
  imports: [FormsModule, DragDropModule, StepEditorComponent, ConditionEditorComponent],
  templateUrl: './flow-builder.component.html',
  styleUrl: './flow-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowBuilderComponent implements OnInit {
  definition = model.required<FlowDefinition>();

  protected readonly activeTab = signal<'steps' | 'review' | 'payload' | 'json'>('steps');
  protected readonly selectedStepIndex = signal<number | null>(null);
  protected readonly jsonPreview = signal('');
  protected readonly jsonEdit = signal('');
  protected readonly jsonError = signal<string | null>(null);

  protected readonly stepTypes = STEP_TYPES;

  protected readonly preferencesSchemaJson = computed(() => {
    const ps = this.definition().payloadSchema.preferencesSchema;
    return ps ? JSON.stringify(ps, null, 2) : '';
  });

  protected readonly selectedStep = computed(() => {
    const idx = this.selectedStepIndex();
    if (idx === null) return null;
    return this.definition().steps[idx] ?? null;
  });

  ngOnInit(): void {
    if (this.definition().steps.length > 0) {
      this.selectedStepIndex.set(0);
    }
  }

  // ── Steps management ───────────────────────────────────────────────────────

  protected addStep(): void {
    const def = this.definition();
    const id = `step-${Date.now().toString(36)}`;
    const newStep: StepSchema = {
      id,
      type: 'single-select-grid',
      title: 'Nieuwe stap',
      visibleWhen: null,
      completeWhen: null,
      inputMap: {},
      outputMap: {},
    };
    this.definition.set({
      ...def,
      steps: [...def.steps, newStep],
    });
    this.selectedStepIndex.set(def.steps.length);
  }

  protected duplicateStep(idx: number): void {
    const def = this.definition();
    const original = def.steps[idx];
    if (!original) return;
    const copy: StepSchema = {
      ...structuredClone(original),
      id: `${original.id}-copy`,
      title: `${original.title} (copy)`,
    };
    const steps = [...def.steps];
    steps.splice(idx + 1, 0, copy);
    this.definition.set({ ...def, steps });
    this.selectedStepIndex.set(idx + 1);
  }

  protected removeStep(idx: number): void {
    const def = this.definition();
    const steps = def.steps.filter((_, i) => i !== idx);
    this.definition.set({ ...def, steps });
    if (this.selectedStepIndex() === idx) {
      this.selectedStepIndex.set(steps.length > 0 ? Math.min(idx, steps.length - 1) : null);
    } else if ((this.selectedStepIndex() ?? 0) > idx) {
      this.selectedStepIndex.update(v => v === null ? null : v - 1);
    }
  }

  protected onStepDrop(event: CdkDragDrop<StepSchema[]>): void {
    const def = this.definition();
    const steps = [...def.steps];
    moveItemInArray(steps, event.previousIndex, event.currentIndex);
    this.definition.set({ ...def, steps });
    if (this.selectedStepIndex() === event.previousIndex) {
      this.selectedStepIndex.set(event.currentIndex);
    }
  }

  protected updateStep(step: StepSchema): void {
    const idx = this.selectedStepIndex();
    if (idx === null) return;
    const def = this.definition();
    const steps = [...def.steps];
    steps[idx] = step;
    this.definition.set({ ...def, steps });
  }

  protected getStepTypeLabel(type: string): string {
    return STEP_TYPES.find(t => t.value === type)?.label ?? type;
  }

  // ── Review template management ─────────────────────────────────────────────

  protected getReviewSections(): ReviewSectionTemplate[] {
    return [...this.definition().reviewTemplate];
  }

  protected addReviewSection(): void {
    const def = this.definition();
    const section: ReviewSectionTemplate = {
      title: 'Nieuwe sectie',
      editStepId: '',
      items: [],
    };
    this.definition.set({
      ...def,
      reviewTemplate: [...def.reviewTemplate, section],
    });
  }

  protected removeReviewSection(idx: number): void {
    const def = this.definition();
    const reviewTemplate = def.reviewTemplate.filter((_, i) => i !== idx);
    this.definition.set({ ...def, reviewTemplate });
  }

  protected updateReviewSection(idx: number, key: string, value: unknown): void {
    const def = this.definition();
    const reviewTemplate: ReviewSectionTemplate[] = [...def.reviewTemplate];
    const existing = reviewTemplate[idx];
    if (!existing) return;
    reviewTemplate[idx] = { title: existing.title, editStepId: existing.editStepId, items: existing.items, [key]: value };
    this.definition.set({ ...def, reviewTemplate });
  }

  protected addReviewItem(sectionIdx: number): void {
    const def = this.definition();
    const reviewTemplate: ReviewSectionTemplate[] = [...def.reviewTemplate];
    const existing = reviewTemplate[sectionIdx];
    if (!existing) return;
    reviewTemplate[sectionIdx] = { ...existing, items: [...existing.items, { label: '', source: { $draft: '' } }] };
    this.definition.set({ ...def, reviewTemplate });
  }

  protected removeReviewItem(sectionIdx: number, itemIdx: number): void {
    const def = this.definition();
    const reviewTemplate: ReviewSectionTemplate[] = [...def.reviewTemplate];
    const existing = reviewTemplate[sectionIdx];
    if (!existing) return;
    reviewTemplate[sectionIdx] = { ...existing, items: existing.items.filter((_, i) => i !== itemIdx) };
    this.definition.set({ ...def, reviewTemplate });
  }

  protected updateReviewItemLabel(sectionIdx: number, itemIdx: number, label: string): void {
    const def = this.definition();
    const reviewTemplate: ReviewSectionTemplate[] = [...def.reviewTemplate];
    const existing = reviewTemplate[sectionIdx];
    if (!existing) return;
    const items = [...existing.items];
    const item = items[itemIdx];
    if (!item) return;
    items[itemIdx] = { ...item, label };
    reviewTemplate[sectionIdx] = { ...existing, items };
    this.definition.set({ ...def, reviewTemplate });
  }

  protected getReviewItemSourceType(item: ReviewSectionTemplate['items'][0]): string {
    return '$draft' in item.source ? 'draft' : 'literal';
  }

  protected getReviewItemSourceField(item: ReviewSectionTemplate['items'][0]): string {
    if ('$draft' in item.source) return item.source.$draft;
    if ('$literal' in item.source) return item.source.$literal;
    return '';
  }

  protected getReviewItemFormat(item: ReviewSectionTemplate['items'][0]): string {
    if ('$draft' in item.source) return item.source.format ?? '';
    return '';
  }

  protected updateReviewItemSource(sectionIdx: number, itemIdx: number, type: string, field: string, format: string): void {
    const def = this.definition();
    const reviewTemplate: ReviewSectionTemplate[] = [...def.reviewTemplate];
    const existing = reviewTemplate[sectionIdx];
    if (!existing) return;
    const items = [...existing.items];
    const item = items[itemIdx];
    if (!item) return;
    if (type === 'draft') {
      items[itemIdx] = { ...item, source: { $draft: field, ...(format ? { format: format as 'mm' | 'boolean' | 'option-label' } : {}) } };
    } else {
      items[itemIdx] = { ...item, source: { $literal: field } };
    }
    reviewTemplate[sectionIdx] = { ...existing, items };
    this.definition.set({ ...def, reviewTemplate });
  }

  // ── Payload schema management ──────────────────────────────────────────────

  protected updatePayload<K extends keyof PayloadSchema>(key: K, value: PayloadSchema[K]): void {
    const def = this.definition();
    this.definition.set({
      ...def,
      payloadSchema: { ...def.payloadSchema, [key]: value },
    });
  }

  protected addMeasurementField(): void {
    const def = this.definition();
    const fields = [...def.payloadSchema.measurementFields];
    fields.push({ key: '', label: '', unit: 'mm', draftField: '' });
    this.definition.set({
      ...def,
      payloadSchema: { ...def.payloadSchema, measurementFields: fields },
    });
  }

  protected removeMeasurementField(idx: number): void {
    const def = this.definition();
    const fields = def.payloadSchema.measurementFields.filter((_, i) => i !== idx);
    this.definition.set({
      ...def,
      payloadSchema: { ...def.payloadSchema, measurementFields: fields },
    });
  }

  protected updateMeasurementField(idx: number, key: string, value: string): void {
    const def = this.definition();
    const fields = [...def.payloadSchema.measurementFields];
    const existing = fields[idx];
    if (!existing) return;
    fields[idx] = { key: existing.key, label: existing.label, unit: existing.unit, draftField: existing.draftField, [key]: value };
    this.definition.set({
      ...def,
      payloadSchema: { ...def.payloadSchema, measurementFields: fields },
    });
  }

  // ── JSON tab ──────────────────────────────────────────────────────────────

  protected onTabChange(tab: 'steps' | 'review' | 'payload' | 'json'): void {
    this.activeTab.set(tab);
    if (tab === 'json') {
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
      this.jsonError.set('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  protected tryParsePreferencesSchema(raw: string): void {
    try {
      const parsed = JSON.parse(raw);
      this.updatePayload('preferencesSchema', parsed);
    } catch {
      // ignore parse errors while typing
    }
  }
}
