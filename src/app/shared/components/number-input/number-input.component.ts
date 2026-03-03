 
import { Component, computed, input, model, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldShellComponent } from '../field-shell/field-shell.component';

@Component({
  selector: 'shared-number-input',
  imports: [FormsModule, FieldShellComponent],
  template: `
    <shared-field-shell
      [label]="label()"
      [required]="required()"
      [hint]="hint()"
      [error]="error()"
      [uid]="uid()"
      [hintId]="hintId()"
      [errorId]="errorId()"
    >
      <div class="relative flex items-center">
        @if (prefix()) {
          <span class="absolute left-3 text-zinc-400 text-sm pointer-events-none">{{ prefix() }}</span>
        }
        <input
          [id]="uid()"
          type="number"
          [placeholder]="placeholder()"
          [ngModel]="value()"
          (ngModelChange)="onValueChange($event)"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [required]="required()"
          [attr.min]="min() ?? null"
          [attr.max]="max() ?? null"
          [step]="step()"
          [attr.aria-required]="required()"
          [attr.aria-invalid]="!!error()"
          [attr.aria-label]="ariaLabel() || label() || placeholder()"
          [attr.aria-describedby]="describedBy()"
          class="w-full px-4 py-3 text-sm bg-white border rounded transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400 read-only:bg-zinc-50 read-only:cursor-default"
          [class.pl-9]="prefix()"
          [class.pl-4]="!prefix()"
          [class.pr-9]="suffix()"
          [class.pr-4]="!suffix()"
          [class.text-right]="alignRight()"
          [class.border-zinc-200]="!error()"
          [class.hover:border-zinc-300]="!error() && !disabled()"
          [class.focus:border-black]="!error()"
          [class.border-red-500]="!!error()"
          [class.focus:border-red-600]="!!error()"
        />
        @if (suffix()) {
          <span class="absolute right-3 text-zinc-400 text-sm pointer-events-none">{{ suffix() }}</span>
        }
      </div>
    </shared-field-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    /* Hide number spin buttons */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    input[type="number"] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
  `,
})
export class NumberInputComponent {
  value = model<number | null>(null);
  id = input<string | undefined>(undefined);
  label = input<string>('');
  placeholder = input('0');
  disabled = input(false);
  readonly = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  ariaLabel = input<string | undefined>(undefined);
  prefix = input<string>('');
  suffix = input<string>('');
  min = input<number | undefined>(undefined);
  max = input<number | undefined>(undefined);
  step = input<number>(0.01);
  alignRight = input(false);

  protected readonly uid = computed(() => this.id() || 'number-input-' + Math.random().toString(36).substring(2, 9));
  protected readonly hintId = computed(() => this.uid() + '-hint');
  protected readonly errorId = computed(() => this.uid() + '-error');

  protected describedBy() {
    const ids = [];
    if (this.error()) ids.push(this.errorId());
    if (this.hint()) ids.push(this.hintId());
    return ids.join(' ') || undefined;
  }

  protected onValueChange(val: number | string | null): void {
    if (val === null || val === '' || val === undefined) {
      this.value.set(null);
    } else {
      const numVal = typeof val === 'string' ? Number.parseFloat(val) : val;
      this.value.set(Number.isNaN(numVal) ? null : numVal);
    }
  }
}
