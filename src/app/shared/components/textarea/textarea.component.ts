import { Component, input, model, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldShellComponent } from '../field-shell/field-shell.component';

@Component({
  selector: 'shared-textarea',
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
        class="w-full px-4 py-3 text-sm bg-white border rounded transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:bg-zinc-50 disabled:cursor-not-allowed placeholder:text-zinc-400 resize-y"
        [class.border-zinc-200]="!error()"
        [class.focus:border-black]="!error()"
        [class.border-red-500]="!!error()"
        [class.focus:border-red-600]="!!error()"
        [class.min-h-12]="rows() <= 1"
        [class.min-h-16]="rows() === 2"
      ></textarea>
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
