import { Component, input, model, ChangeDetectionStrategy } from '@angular/core';
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
          [type]="type()"
          [placeholder]="placeholder()"
          [(ngModel)]="value"
          [disabled]="disabled()"
          [required]="required()"
          [attr.aria-required]="required()"
          [attr.aria-invalid]="!!error()"
          [attr.aria-label]="ariaLabel() || label() || placeholder()"
          [attr.aria-describedby]="describedBy()"
          class="w-full pl-4 py-3 text-sm bg-white border transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400"
          [class.pr-10]="clearable()"
          [class.pr-4]="!clearable()"
          [class.border-zinc-200]="!error()"
          [class.focus:border-black]="!error()"
          [class.border-red-500]="!!error()"
          [class.focus:border-red-600]="!!error()"
        />
        @if (clearable() && value()) {
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
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  ariaLabel = input<string | undefined>(undefined);
  clearable = input(true);

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
    if (this.disabled()) return;
    this.value.set('');
  }
}
