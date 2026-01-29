import { Component, input, model, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'shared-checkbox',
  standalone: true,
  imports: [FormsModule],
  template: `
    <label
      class="group flex w-full cursor-pointer select-none"
      [class.items-center]="dense()"
      [class.items-start]="!dense()"
      [class.gap-2]="dense()"
      [class.gap-3]="!dense()"
      [class.text-left]="!!label()"
      [class.text-center]="!label()"
      [class.justify-center]="!label()"
    >
      <div class="relative flex items-center justify-center">
        <input
          type="checkbox"
          [id]="uid"
          [(ngModel)]="checked"
          [disabled]="disabled()"
          [required]="required()"
          [attr.aria-required]="required()"
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-label]="ariaLabel() || label() || undefined"
          [indeterminate]="indeterminate()"
          class="peer sr-only"
        />
        
        <!-- Custom Box -->
        <div 
          class="w-5 h-5 border border-zinc-200 bg-white transition-all duration-200 
                 group-hover:border-black 
                 peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2
                 peer-checked:bg-black peer-checked:border-black
                 peer-disabled:opacity-50 peer-disabled:bg-zinc-50 peer-disabled:cursor-not-allowed
                 peer-disabled:group-hover:border-zinc-200"
          [class.border-red-500]="!!error()"
        ></div>

        <!-- Checkmark Icon -->
        <svg 
          class="absolute w-3.5 h-3.5 text-white scale-0 transition-transform duration-200 peer-checked:scale-100 peer-disabled:text-zinc-300" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          stroke-width="4"
        >
          <path stroke-linecap="square" stroke-linejoin="miter" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div class="flex flex-col gap-0.5">
        @if (label()) {
          <span class="text-sm font-medium uppercase tracking-tight text-black transition-colors duration-200 group-hover:text-zinc-600 peer-disabled:text-zinc-400">
            {{ label() }}
            @if (required()) {
              <span class="text-red-500" aria-hidden="true">*</span>
            }
          </span>
        }
        
        @if (error()) {
          <p [id]="errorId" class="text-[10px] uppercase font-bold text-red-500 tracking-wide">
            {{ error() }}
          </p>
        } @else if (hint()) {
          <p [id]="hintId" class="text-[10px] uppercase font-medium text-zinc-400 tracking-wide">
            {{ hint() }}
          </p>
        }
      </div>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class CheckboxComponent {
  checked = model<boolean>(false);
  id = input<string | undefined>(undefined);
  label = input<string>('');
  disabled = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  ariaLabel = input<string | undefined>(undefined);
  indeterminate = input(false);
  dense = input(false);

  protected readonly uid = this.id() || 'checkbox-' + Math.random().toString(36).substring(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected describedBy() {
    const ids = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.join(' ') || undefined;
  }
}
