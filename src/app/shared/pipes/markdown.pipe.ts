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
  const lines = input.replaceAll('\r\n', '\n').split('\n');
  const state = {
    html: '',
    inParagraph: false,
    inOrderedList: false,
    inUnorderedList: false,
    inListItem: false,
  };

  const orderedRegex = /^(\d+)\.\s+(.*)$/;
  const unorderedRegex = /^-\s+(.*)$/;

  const closeParagraph = () => {
    if (!state.inParagraph) return;
    state.html += '</p>';
    state.inParagraph = false;
  };

  const closeUnorderedList = () => {
    if (!state.inUnorderedList) return;
    state.html += '</ul>';
    state.inUnorderedList = false;
  };

  const closeListItem = () => {
    if (!state.inListItem) return;
    closeUnorderedList();
    state.html += '</li>';
    state.inListItem = false;
  };

  const closeOrderedList = () => {
    if (!state.inOrderedList) return;
    closeListItem();
    state.html += '</ol>';
    state.inOrderedList = false;
  };

  const openParagraphOrBreak = () => {
    if (state.inParagraph) {
      state.html += '<br>';
      return;
    }
    state.html += '<p>';
    state.inParagraph = true;
  };

  const handleOrderedLine = (line: string): boolean => {
    const match = orderedRegex.exec(line);
    if (!match) return false;
    closeParagraph();
    if (!state.inOrderedList) {
      state.html += '<ol>';
      state.inOrderedList = true;
    }
    closeListItem();
    state.html += `<li>${applyInlineMarkdown(match[2] ?? '')}`;
    state.inListItem = true;
    return true;
  };

  const handleUnorderedLine = (line: string): boolean => {
    const match = unorderedRegex.exec(line);
    if (!match) return false;
    closeParagraph();
    if (!state.inUnorderedList) {
      state.html += '<ul>';
      state.inUnorderedList = true;
    }
    state.html += `<li>${applyInlineMarkdown(match[1] ?? '')}</li>`;
    return true;
  };

  const handleOrderedContinuation = (line: string): boolean => {
    if (!state.inOrderedList || !state.inListItem) return false;
    state.html += `<br>${applyInlineMarkdown(line)}`;
    return true;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeParagraph();
      continue;
    }

    if (handleOrderedLine(line)) continue;
    if (handleUnorderedLine(line)) continue;
    if (handleOrderedContinuation(line)) continue;

    openParagraphOrBreak();
    state.html += applyInlineMarkdown(line);
  }

  closeParagraph();
  closeOrderedList();
  closeUnorderedList();

  return state.html;
}

function applyInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
