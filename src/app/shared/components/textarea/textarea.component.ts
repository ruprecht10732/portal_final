import { Component, input, model, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'shared-textarea',
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
      <textarea
        [id]="uid"
        [placeholder]="placeholder()"
        [(ngModel)]="value"
        [disabled]="disabled()"
        [required]="required()"
        [rows]="rows()"
        [attr.aria-required]="required()"
        [attr.aria-invalid]="!!error()"
        [attr.aria-describedby]="describedBy()"
        class="w-full px-4 py-3 text-sm bg-white border transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400 min-h-25 resize-y"
        [class.border-zinc-200]="!error()"
        [class.focus:border-black]="!error()"
        [class.border-red-500]="!!error()"
        [class.focus:border-red-600]="!!error()"
      ></textarea>
      
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
export class TextareaComponent {
  value = model<string>('');
  id = input<string | undefined>(undefined);
  label = input<string>('');
  placeholder = input('');
  disabled = input(false);
  required = input(false);
  rows = input(4);
  hint = input<string>('');
  error = input<string>('');

  protected readonly uid = this.id() || 'textarea-' + Math.random().toString(36).substring(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected describedBy() {
    const ids = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.join(' ') || undefined;
  }
}
