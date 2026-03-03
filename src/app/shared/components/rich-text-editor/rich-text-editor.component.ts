import { ChangeDetectionStrategy, Component, input, model, signal, viewChild, type AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillEditorComponent, type QuillModules } from 'ngx-quill';
import { FieldShellComponent } from '../field-shell/field-shell.component';

export interface TemplateVariable {
  label: string;
  value: string;
}

@Component({
  selector: 'shared-rich-text-editor',
  imports: [FormsModule, QuillEditorComponent, FieldShellComponent],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextEditorComponent implements AfterViewInit {
  value = model<string>('');

  label = input<string>('');
  placeholder = input('');
  disabled = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  minHeight = input(160);
  variables = input<TemplateVariable[]>([]);

  protected readonly uid = 'richtext-' + Math.random().toString(36).slice(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';
  protected readonly showVariableDropdown = signal(false);

  private readonly editorRef = viewChild(QuillEditorComponent);

  protected readonly modules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  ngAfterViewInit(): void {
    const editor = this.editorRef();
    if (!editor) return;

    editor.onEditorCreated.subscribe(() => {
      this.addVariableButton();
    });
  }

  private addVariableButton(): void {
    const editor = this.editorRef();
    if (!editor?.quillEditor) return;

    const toolbar = editor.quillEditor.getModule('toolbar') as { container?: HTMLElement };
    if (!toolbar?.container) return;

    const existing = toolbar.container.querySelector('.ql-variable-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ql-variable-btn';
    btn.innerHTML = '<svg viewBox="0 0 18 18" width="18" height="18"><text x="1" y="14" font-size="12" font-family="sans-serif" font-weight="600" fill="currentColor">{x}</text></svg>';
    btn.title = 'Variabele invoegen';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showVariableDropdown.update(v => !v);
    });

    const span = document.createElement('span');
    span.className = 'ql-formats';
    span.appendChild(btn);
    toolbar.container.appendChild(span);
  }

  protected insertVariable(variable: TemplateVariable): void {
    this.showVariableDropdown.set(false);

    const editor = this.editorRef();
    if (!editor?.quillEditor) return;

    const quill = editor.quillEditor;
    const selection = quill.getSelection(true);
    const index = selection?.index ?? quill.getLength();

    quill.insertText(index, `{{${variable.value}}}`, 'user');
    quill.setSelection(index + variable.value.length + 4, 0);
  }

  protected closeDropdown(): void {
    this.showVariableDropdown.set(false);
  }

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }

}
