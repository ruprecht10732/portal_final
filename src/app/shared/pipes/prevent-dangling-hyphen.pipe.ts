import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'preventDanglingHyphen',
})
export class PreventDanglingHyphenPipe implements PipeTransform {
  transform(value: string | null | undefined = ''): string {
    if (!value) return '';

    // Keep leading "- " pairs together so the hyphen never dangles on its own line.
    return value.replaceAll(/(^|>|[\r\n]|<br\s*\/?>)\s*-\s+/gi, '$1-&nbsp;');
  }
}
