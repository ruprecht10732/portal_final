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
    map(profile => profile?.roles?.includes(ROLES.superadmin) || router.createUrlTree(['/app/dashboard'])),
    catchError(() => of(router.createUrlTree(['/app/dashboard']))),
  );
};
