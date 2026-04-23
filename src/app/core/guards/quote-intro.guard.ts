import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type CanActivateFn, Router } from '@angular/router';

/**
 * Redirects first-time visitors to the intro page for a specific quote.
 * * Principal Note: This guard is SSR-safe. In non-browser environments 
 * (Prerendering/SSR), it skips the intro check to prevent execution errors.
 */
export const quoteIntroGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const token = route.paramMap.get('token')?.trim();

  // If no token exists, we can't show a specific intro; proceed to the route.
  if (!token) {
    return true;
  }

  // Ensure we are in the browser before touching localStorage.
  if (isPlatformBrowser(platformId)) {
    try {
      const storageKey = `quote_intro_seen_${token}`;
      const hasSeenIntro = !!localStorage.getItem(storageKey);

      if (hasSeenIntro) {
        return true;
      }
    } catch {
      // In case of Storage quota errors or privacy settings blocking access, 
      // we prioritize user access over the marketing intro.
      return true;
    }

    // First time seeing this token; redirect to intro.
    return router.createUrlTree(['/quote', token, 'intro']);
  }

  // Default to true for SSR/Prerendering to avoid redirect loops on the server.
  return true;
};