import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillEditorComponent, type QuillModules } from 'ngx-quill';
import { FieldShellComponent } from '../field-shell/field-shell.component';

@Component({
  selector: 'shared-rich-text-editor',
  imports: [FormsModule, QuillEditorComponent, FieldShellComponent],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextEditorComponent {
  value = model<string>('');

  label = input<string>('');
  placeholder = input('');
  disabled = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  minHeight = input(160);

  protected readonly uid = 'richtext-' + Math.random().toString(36).slice(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected readonly modules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }

}
