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

export const buildPasswordRules = (checks: PasswordChecks, minLength: number): PasswordRule[] => [
  { label: `At least ${minLength} characters`, met: checks.hasMinLength },
  { label: 'Contains a number', met: checks.hasNumber },
  { label: 'Contains an uppercase letter', met: checks.hasUppercase },
  { label: 'Contains a special character', met: checks.hasSpecial },
];

export const getPasswordMinLengthError = (password: string, minLength: number): string => {
  if (!password) return '';
  return password.length >= minLength ? '' : `Password must be at least ${minLength} characters`;
};

export const getConfirmPasswordError = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) return '';
  return password === confirmPassword ? '' : 'Passwords do not match';
};
