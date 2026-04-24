import { Signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { isEmailValid } from './email.util';

export interface PasswordRule {
  label: string;
  met: boolean;
}

export interface PasswordChecks {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasUppercase: boolean;
  hasSpecial: boolean;
}

export const getEmailError = (value: string): string => {
  if (!value) return '';
  return isEmailValid(value) ? '' : 'Email format is invalid';
};

export const getPasswordChecks = (password: string, minLength: number): PasswordChecks => ({
  hasMinLength: password.length >= minLength,
  hasNumber: /\d/.test(password),
  hasUppercase: /[A-Z]/.test(password),
  hasSpecial: /[^A-Za-z0-9]/.test(password),
});

export const getPasswordMinLengthError = (password: string, minLength: number): string => {
  if (!password) return '';
  return password.length >= minLength ? '' : `Password must be at least ${minLength} characters`;
};

export const getConfirmPasswordError = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) return '';
  return password === confirmPassword ? '' : 'Passwords do not match';
};

export function createEmailError(email: Signal<string>, translate: TranslateService) {
  return computed(() => {
    const raw = getEmailError(email());
    return raw ? translate.instant('auth.form.emailError') : '';
  });
}

export function createPasswordError(password: Signal<string>, minLength: number, translate: TranslateService) {
  return computed(() => {
    const raw = getPasswordMinLengthError(password(), minLength);
    return raw ? translate.instant('auth.form.passwordError', { minLength }) : '';
  });
}

export function createPasswordChecks(password: Signal<string>, minLength: number) {
  return computed(() => getPasswordChecks(password(), minLength));
}

export function createPasswordRules(checks: Signal<PasswordChecks>, minLength: number, translate: TranslateService) {
  return computed(() => {
    const c = checks();
    return [
      { label: translate.instant('auth.passwordRules.minLength', { minLength }), met: c.hasMinLength },
      { label: translate.instant('auth.passwordRules.hasNumber'), met: c.hasNumber },
      { label: translate.instant('auth.passwordRules.hasUppercase'), met: c.hasUppercase },
      { label: translate.instant('auth.passwordRules.hasSpecial'), met: c.hasSpecial },
    ];
  });
}
