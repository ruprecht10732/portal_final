import { ChangeDetectionStrategy, Component, model, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type Condition, CONDITION_OPERATORS } from '../flow-builder.types';

@Component({
  selector: 'app-condition-editor',
  imports: [FormsModule],
  templateUrl: './condition-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionEditorComponent {
  condition = model<Condition | null>(null);
  label = input('Condition');
  allowNull = input(true);
  draftFieldSuggestions = input<string[]>([]);

  protected readonly operators = CONDITION_OPERATORS;
  protected readonly expanded = signal(false);

  protected readonly currentOp = computed(() => {
    const c = this.condition();
    return c?.op ?? null;
  });

  protected toggle(): void {
    this.expanded.update(v => !v);
  }

  protected enable(): void {
    this.condition.set({ op: 'truthy', field: '' });
  }

  protected disable(): void {
    this.condition.set(null);
  }

  protected setOp(op: string): void {
    switch (op) {
      case 'truthy':
      case 'falsy':
        this.condition.set({ op, field: this.getField() } as Condition);
        break;
      case 'eq':
      case 'neq':
        this.condition.set({ op, field: this.getField(), value: '' } as Condition);
        break;
      case 'in':
      case 'not_in':
        this.condition.set({ op, field: this.getField(), values: [] } as Condition);
        break;
      case 'and':
      case 'or':
        this.condition.set({ op, conditions: [] } as Condition);
        break;
      case 'not':
        this.condition.set({ op: 'not', condition: { op: 'truthy', field: '' } } as Condition);
        break;
    }
  }

  protected setField(field: string): void {
    const c = this.condition();
    if (!c) return;
    if ('field' in c) {
      this.condition.set({ ...c, field } as Condition);
    }
  }

  protected setValue(value: string): void {
    const c = this.condition();
    if (!c) return;
    if ('value' in c) {
      this.condition.set({ ...c, value } as Condition);
    }
  }

  protected setValues(raw: string): void {
    const c = this.condition();
    if (!c) return;
    if ('values' in c) {
      const values = raw.split(',').map(v => v.trim()).filter(Boolean);
      this.condition.set({ ...c, values } as Condition);
    }
  }

  protected getField(): string {
    const c = this.condition();
    if (c && 'field' in c) return c.field;
    return '';
  }

  protected getValueStr(): string {
    const c = this.condition();
    if (c && 'value' in c) return this.stringifyUnknown(c.value);
    return '';
  }

  protected getValuesStr(): string {
    const c = this.condition();
    if (c && 'values' in c) return c.values.map(value => this.stringifyUnknown(value)).join(', ');
    return '';
  }

  protected getSubConditions(): Condition[] {
    const c = this.condition();
    if (c && 'conditions' in c) return [...c.conditions];
    return [];
  }

  protected getSubCondition(): Condition | null {
    const c = this.condition();
    if (c && 'condition' in c) return c.condition;
    return null;
  }

  protected updateSubConditions(conditions: Condition[]): void {
    const c = this.condition();
    if (c && 'conditions' in c) {
      this.condition.set({ ...c, conditions } as Condition);
    }
  }

  protected addSubCondition(): void {
    const subs = this.getSubConditions();
    subs.push({ op: 'truthy', field: '' });
    this.updateSubConditions(subs);
  }

  protected removeSubCondition(idx: number): void {
    const subs = this.getSubConditions();
    subs.splice(idx, 1);
    this.updateSubConditions(subs);
  }

  protected updateSubCondition(idx: number, cond: Condition | null): void {
    if (!cond) return;
    const subs = this.getSubConditions();
    subs[idx] = cond;
    this.updateSubConditions(subs);
  }

  protected updateNotCondition(cond: Condition | null): void {
    if (!cond) return;
    const c = this.condition();
    if (c?.op === 'not') {
      this.condition.set({ op: 'not', condition: cond });
    }
  }

  protected isCompound(): boolean {
    const op = this.currentOp();
    return op === 'and' || op === 'or' || op === 'not';
  }

  protected hasField(): boolean {
    const op = this.currentOp();
    return !!op && !this.isCompound();
  }

  protected hasValue(): boolean {
    const op = this.currentOp();
    return op === 'eq' || op === 'neq';
  }

  protected hasValues(): boolean {
    const op = this.currentOp();
    return op === 'in' || op === 'not_in';
  }

  protected conditionSummary(): string {
    const c = this.condition();
    if (!c) return 'Geen (altijd zichtbaar)';
    if ('field' in c) {
      const field = c.field || '?';
      switch (c.op) {
        case 'truthy': return `${field} is ingevuld`;
        case 'falsy': return `${field} is niet ingevuld`;
        case 'eq': return `${field} = ${this.stringifyUnknown(c.value)}`;
        case 'neq': return `${field} ≠ ${this.stringifyUnknown(c.value)}`;
        case 'in': return `${field} in [${c.values.map(value => this.stringifyUnknown(value)).join(', ')}]`;
        case 'not_in': return `${field} niet in [${c.values.map(value => this.stringifyUnknown(value)).join(', ')}]`;
      }
    }
    if (c.op === 'and') return `Alle waar (${(c as { conditions: Condition[] }).conditions.length} voorwaarden)`;
    if (c.op === 'or') return `Eén waar (${(c as { conditions: Condition[] }).conditions.length} voorwaarden)`;
    if (c.op === 'not') return `NIET (...)`;
    return JSON.stringify(c);
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
