import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { OrganizationService } from '../services/organization.service';
import { UserService } from '../services/user.service';

export const onboardingGuard: CanActivateChildFn = (_route, state) => {
  const router = inject(Router);
  const userService = inject(UserService);
  const orgService = inject(OrganizationService);

  if (state.url.startsWith('/app/onboarding')) {
    return true;
  }

  return userService.getProfile().pipe(
    switchMap((profile) => {
      const needsProfile = !profile.firstName || !profile.lastName;
      const isAdmin = profile.roles.includes('admin');
      if (!isAdmin) {
        return of(needsProfile ? router.createUrlTree(['/app/onboarding']) : true);
      }

      return orgService.getOrganization().pipe(
        map((org) => {
          const needsOnboarding = needsProfile || !org?.name;
          return needsOnboarding ? router.createUrlTree(['/app/onboarding']) : true;
        }),
        catchError(() => of(router.createUrlTree(['/app/onboarding'])))
      );
    }),
    catchError(() => of(router.createUrlTree(['/sign-in'])))
  );
};
