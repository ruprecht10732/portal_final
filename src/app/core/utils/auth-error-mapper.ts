import { getErrorMessage } from './error-utils';

const AUTH_ERROR_MAP = {
  'invalid credentials': 'The email or password you entered is incorrect. Please double-check and try again.',
  'user not found': "We couldn't find an account with this email address. Please check your email or sign up for a new account.",
  'email already exists': 'An account with this email already exists. Please sign in or use a different email address.',
  'token invalid': 'Your session has expired. Please sign in again.',
  'token expired': 'Your session has expired. Please sign in again.',
  'weak password': 'Please choose a stronger password with at least 8 characters.',
} as const;

type AuthErrorKey = keyof typeof AUTH_ERROR_MAP;

const SUBSTRING_PATTERNS: { test: (s: string) => boolean; key: AuthErrorKey }[] = [
  { test: s => s.includes('invalid credential'), key: 'invalid credentials' },
  { test: s => s.includes('token') && s.includes('expired'), key: 'token expired' },
  { test: s => s.includes('token') && s.includes('invalid'), key: 'token invalid' },
  { test: s => s.includes('user not found') || s.includes('account not found'), key: 'user not found' },
  { test: s => s.includes('email') && s.includes('already'), key: 'email already exists' },
  { test: s => s.includes('weak password') || s.includes('password too short'), key: 'weak password' },
];

export const getAuthErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  const normalized = message.trim().toLowerCase();

  if (normalized in AUTH_ERROR_MAP) {
    return AUTH_ERROR_MAP[normalized as AuthErrorKey];
  }

  const match = SUBSTRING_PATTERNS.find(p => p.test(normalized));
  if (match) {
    return AUTH_ERROR_MAP[match.key];
  }

  return message;
};
