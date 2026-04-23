import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';
import { ROLES } from '../config';

/**
 * Principal Note: This guard enforces the highest privilege level.
 * It assumes the UserService handles caching so we aren't hammering
 * the /profile endpoint on every navigation.
 */
export const superadminGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.getProfile().pipe(
    map((profile) => {
      const roles = profile?.roles ?? [];
      const hasAccess = roles.includes(ROLES.superadmin);

      if (hasAccess) {
        return true;
      }

      // Unauthorized for this specific area? Divert to the main dashboard.
      return router.createUrlTree(['/app/dashboard']);
    }),
    catchError(() => {
      // If the profile can't be fetched, we cannot prove superadmin status.
      // We divert to dashboard and let the global error handler or interceptor
      // deal with the underlying network/auth issue.
      return of(router.createUrlTree(['/app/dashboard']));
    })
  );
};