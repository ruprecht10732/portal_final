import { Pipe, type PipeTransform } from '@angular/core';
import { formatPhoneDisplay } from '../../core/utils/phone.util';

@Pipe({
  name: 'phoneFormat',
})
export class PhoneFormatPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return formatPhoneDisplay(value);
  }
}
