import { Pipe, PipeTransform, inject, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
})
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const source = (value ?? '').trim();
    if (!source) return '';
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, source) ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }
}
