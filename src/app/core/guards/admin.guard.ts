import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';
import { ROLES } from '../config';

export const adminGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.getProfile().pipe(
    map(profile => profile.roles?.includes(ROLES.admin) ? true : router.createUrlTree(['/app/dashboard'])),
    catchError(() => of(router.createUrlTree(['/app/dashboard']))),
  );
};