import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const source = (value ?? '').trim();
    if (!source) return '';
    const html = renderMarkdown(source);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

function renderMarkdown(input: string): string {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inParagraph = false;
  let inOrderedList = false;
  let inUnorderedList = false;
  let inListItem = false;

  const closeParagraph = () => {
    if (!inParagraph) return;
    html += '</p>';
    inParagraph = false;
  };

  const closeUnorderedList = () => {
    if (!inUnorderedList) return;
    html += '</ul>';
    inUnorderedList = false;
  };

  const closeListItem = () => {
    if (!inListItem) return;
    closeUnorderedList();
    html += '</li>';
    inListItem = false;
  };

  const closeOrderedList = () => {
    if (!inOrderedList) return;
    closeListItem();
    html += '</ol>';
    inOrderedList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeParagraph();
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      closeParagraph();
      if (!inOrderedList) {
        html += '<ol>';
        inOrderedList = true;
      }
      closeListItem();
      html += `<li>${applyInlineMarkdown(orderedMatch[2] ?? '')}`;
      inListItem = true;
      continue;
    }

    const unorderedMatch = line.match(/^-\s+(.*)$/);
    if (unorderedMatch) {
      closeParagraph();
      if (!inUnorderedList) {
        html += '<ul>';
        inUnorderedList = true;
      }
      html += `<li>${applyInlineMarkdown(unorderedMatch[1] ?? '')}</li>`;
      continue;
    }

    if (inOrderedList && inListItem) {
      html += `<br>${applyInlineMarkdown(line)}`;
      continue;
    }

    if (!inParagraph) {
      html += '<p>';
      inParagraph = true;
    } else {
      html += '<br>';
    }
    html += applyInlineMarkdown(line);
  }

  closeParagraph();
  closeOrderedList();
  closeUnorderedList();

  return html;
}

function applyInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
