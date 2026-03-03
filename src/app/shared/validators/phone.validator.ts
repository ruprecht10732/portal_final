import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';

const DEFAULT_REGION: CountryCode = 'NL';

export function phoneValidator(region: CountryCode = DEFAULT_REGION): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }

    return isValidPhoneNumber(value, region) ? null : { invalidPhone: true };
  };
}
