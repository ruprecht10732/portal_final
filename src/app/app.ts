import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of, switchMap, take, tap } from 'rxjs';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { AccountRegistryService } from './core/services/account-registry.service';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly translate = inject(TranslateService);
  private readonly accounts = inject(AccountRegistryService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);

  constructor() {
    this.translate.addLangs(['en', 'nl']);
    this.translate.setFallbackLang('en');
    this.translate.use('nl');

    this.bootstrapActiveAccount();
  }

  private bootstrapActiveAccount(): void {
    const activeAccount = this.accounts.usableActiveAccountValue;
    if (!activeAccount) {
      return;
    }

    this.authService.verifyToken(activeAccount.token)
      .pipe(
        take(1),
        tap(response => this.accounts.updateEmail(activeAccount.uid, response.email)),
        switchMap(() => this.userService.getProfile()),
        catchError(error => {
          if (!this.isUnauthorized(error)) {
            return of(null);
          }

          if (!activeAccount.refreshToken) {
            this.accounts.markExpired(activeAccount.uid);
            return of(null);
          }

          return this.authService.refresh(activeAccount.refreshToken).pipe(
            switchMap(() => this.userService.getProfile()),
            catchError(refreshError => {
              if (this.isUnauthorized(refreshError)) {
                this.accounts.markExpired(activeAccount.uid);
              }
              return of(null);
            })
          );
        })
      )
      .subscribe(profile => {
        const lang = profile?.preferredLanguage === 'en' ? 'en' : 'nl';
        this.translate.use(lang);
      });
  }

  private isUnauthorized(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 401;
  }
}
