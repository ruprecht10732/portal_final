import { getErrorMessage } from './error-utils';

const AUTH_ERROR_MAP: Record<string, string> = {
  'invalid credentials': 'The email or password you entered is incorrect. Please double-check and try again.',
  'user not found': "We couldn't find an account with this email address. Please check your email or sign up for a new account.",
  'email already exists': 'An account with this email already exists. Please sign in or use a different email address.',
  'token invalid': 'Your session has expired. Please sign in again.',
  'token expired': 'Your session has expired. Please sign in again.',
  'weak password': 'Please choose a stronger password with at least 8 characters.',
};

export const getAuthErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  const normalized = message.trim().toLowerCase();

  const mapped = AUTH_ERROR_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  if (normalized.includes('invalid credential')) {
    return AUTH_ERROR_MAP['invalid credentials'];
  }

  if (normalized.includes('token') && normalized.includes('expired')) {
    return AUTH_ERROR_MAP['token expired'];
  }

  if (normalized.includes('token') && normalized.includes('invalid')) {
    return AUTH_ERROR_MAP['token invalid'];
  }

  if (normalized.includes('user not found') || normalized.includes('account not found')) {
    return AUTH_ERROR_MAP['user not found'];
  }

  if (normalized.includes('email') && normalized.includes('already')) {
    return AUTH_ERROR_MAP['email already exists'];
  }

  if (normalized.includes('weak password') || normalized.includes('password too short')) {
    return AUTH_ERROR_MAP['weak password'];
  }

  return message;
};
