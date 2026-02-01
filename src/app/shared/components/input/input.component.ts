import { Component, computed, input, model, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'shared-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col w-full gap-1.5 text-left">
      @if (label()) {
        <label [for]="uid" class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {{ label() }}
          @if (required()) {
            <span class="text-red-500" aria-hidden="true">*</span>
          }
        </label>
      }
      <div class="relative">
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
          class="w-full pl-4 py-3 text-sm bg-white border transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400 read-only:bg-zinc-50 read-only:cursor-default"
          [class.pr-16]="clearable() && showPasswordToggle()"
          [class.pr-10]="(clearable() && !showPasswordToggle()) || (!clearable() && showPasswordToggle())"
          [class.pr-4]="!clearable() && !showPasswordToggle()"
          [class.border-zinc-200]="!error()"
          [class.focus:border-black]="!error()"
          [class.border-red-500]="!!error()"
          [class.focus:border-red-600]="!!error()"
        />
        @if (showPasswordToggle()) {
          <button
            type="button"
            (click)="togglePasswordVisibility()"
            class="absolute top-1/2 -translate-y-1/2 p-2 min-w-8 min-h-8 text-zinc-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            [class.right-2]="!clearable()"
            [class.right-10]="clearable()"
            [attr.aria-label]="passwordToggleLabel()"
            [attr.aria-pressed]="isPasswordVisible()"
          >
            @if (isPasswordVisible()) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.028.154-2.018.441-2.949M6.1 6.1A9.953 9.953 0 0112 5c5.523 0 10 4.477 10 10 0 1.2-.212 2.35-.6 3.414M9.88 9.88a3 3 0 104.24 4.24" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
              </svg>
            } @else {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.522 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          </button>
        }
        @if (clearable() && value() && !readonly()) {
          <button
            type="button"
            (click)="clear()"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-8 min-h-8 text-zinc-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Clear input"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
      </div>
      
      @if (error()) {
        <p [id]="errorId" class="text-[10px] uppercase font-bold text-red-500 tracking-wide mt-1">
          {{ error() }}
        </p>
      } @else if (hint()) {
        <p [id]="hintId" class="text-[10px] uppercase font-medium text-zinc-400 tracking-wide mt-1">
          {{ hint() }}
        </p>
      }
    </div>
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
