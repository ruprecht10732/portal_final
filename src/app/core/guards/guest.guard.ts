import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AccountRegistryService } from '../services/account-registry.service';

export const guestGuard: CanActivateFn = () => {
  const accounts = inject(AccountRegistryService);
  const router = inject(Router);

  // Invoke the computed signal
  if (accounts.usableActiveAccount()) {
    return router.createUrlTree(['/app/dashboard']);
  }

  return true;
};