import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

/**
 * Redirects first-time visitors to the intro page for a quote.
 * Uses localStorage to track whether the intro has been seen.
 */
export const quoteIntroGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const token = route.paramMap.get('token');

  if (!token) return true;

  try {
    if (localStorage.getItem(`quote_intro_seen_${token}`)) {
      return true;
    }
  } catch {
    // localStorage unavailable — skip intro
    return true;
  }

  return router.createUrlTree(['/quote', token, 'intro']);
};
