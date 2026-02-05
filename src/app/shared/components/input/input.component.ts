import { Component, computed, input, model, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldShellComponent } from '../field-shell/field-shell.component';

@Component({
  selector: 'shared-input',
  imports: [FormsModule, FieldShellComponent],
  template: `
   <shared-field-shell
  [label]="label()"
  [required]="required()"
  [hint]="hint()"
  [error]="error()"
  [uid]="uid"
  [hintId]="hintId"
  [errorId]="errorId"
>
  <div class="relative flex w-full items-center">
    <input
      [id]="uid"
      [type]="inputType()"
      [placeholder]="placeholder()"
      [(ngModel)]="value"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [required]="required()"
      [attr.min]="min() || null"
      [attr.max]="max() || null"
      [attr.aria-required]="required()"
      [attr.aria-invalid]="!!error()"
      [attr.aria-label]="ariaLabel() || label() || placeholder()"
      [attr.aria-describedby]="describedBy()"
      [attr.data-type]="inputType()"
      [attr.data-has-icon]="showPasswordToggle() || clearable()"
      class="peer w-full h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400
             transition-all duration-200 ease-out
             focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900
             disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-50
             read-only:cursor-default read-only:bg-zinc-50
             md:text-sm
             file:mr-4 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-900
             data-[type=date]:min-h-[44px] data-[type=datetime-local]:min-h-[44px]
             data-[type=number]:tabular-nums
             data-[has-icon=true]:pr-12"
      [class.border-red-600]="!!error()"
      [class.focus:border-red-600]="!!error()"
      [class.focus:ring-red-600]="!!error()"
      [class.text-red-900]="!!error()"
      [class.pr-24]="clearable() && showPasswordToggle()"
    />

    @if (showPasswordToggle()) {
      <button
        type="button"
        (click)="togglePasswordVisibility()"
        class="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-zinc-400 transition-colors 
               hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900 active:bg-zinc-100"
        [class.mr-11]="clearable()"
        [attr.aria-label]="passwordToggleLabel()"
        [attr.aria-pressed]="isPasswordVisible()"
      >
        @if (isPasswordVisible()) {
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.028.154-2.018.441-2.949M6.1 6.1A9.953 9.953 0 0112 5c5.523 0 10 4.477 10 10 0 1.2-.212 2.35-.6 3.414M9.88 9.88a3 3 0 104.24 4.24" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
          </svg>
        } @else {
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.522 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      </button>
    }

    @if (clearable() && value() && !readonly()) {
      <button
        type="button"
        (click)="clear()"
        class="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-zinc-400 transition-colors 
               hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900 active:bg-zinc-100"
        aria-label="Clear input"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
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
  `,
})
export class InputComponent {
  value = model<string>('');
  id = input<string | undefined>(undefined);
  label = input<string>('');
  type = input('text');
  placeholder = input('');
  disabled = input(false);
  readonly = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  ariaLabel = input<string | undefined>(undefined);
  clearable = input(true);
  passwordToggle = input(false);
  passwordToggleLabel = input('Toggle password visibility');
  min = input<string | undefined>(undefined);
  max = input<string | undefined>(undefined);

  protected readonly isPasswordVisible = signal(false);
  protected readonly showPasswordToggle = computed(() => this.passwordToggle() && this.type() === 'password');
  protected readonly inputType = computed(() => {
    const baseType = this.type();
    if (!this.showPasswordToggle()) return baseType;
    return this.isPasswordVisible() ? 'text' : 'password';
  });

  protected readonly uid = this.id() || 'input-' + Math.random().toString(36).substring(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected describedBy() {
    const ids = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.join(' ') || undefined;
  }

  protected clear(): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set('');
  }

  protected togglePasswordVisibility(): void {
    if (this.disabled()) return;
    this.isPasswordVisible.update(visible => !visible);
  }
}
