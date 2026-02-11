import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';

export const onboardingGuard: CanActivateChildFn = (_route, state) => {
  const router = inject(Router);
  const userService = inject(UserService);

  if (state.url.startsWith('/onboarding')) {
    return true;
  }

  return userService.getProfile().pipe(
    map((profile) => {
      const needsOnboarding = !profile.onboardingCompleted;
      return needsOnboarding ? router.createUrlTree(['/onboarding']) : true;
    }),
    catchError(() => of(router.createUrlTree(['/sign-in'])))
  );
};
