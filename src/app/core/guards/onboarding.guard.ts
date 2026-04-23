import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';

export const onboardingGuard: CanActivateChildFn = (_route, state) => {
  if (state.url.startsWith('/onboarding')) {
    return true;
  }

  const router = inject(Router);
  const userService = inject(UserService);

  return userService.getProfile().pipe(
    map(profile => 
      profile.onboardingCompleted 
        ? true 
        : router.createUrlTree(['/onboarding'])
    ),
    catchError(() => {
      // 1. If this is a 401, our global authInterceptor will catch it, refresh the token, 
      // or hard-route to /sign-in automatically.
      // 2. If it's a 500 or timeout, we return `false` to safely cancel the navigation 
      // without forcefully logging the user out.
      return of(false);
    })
  );
};