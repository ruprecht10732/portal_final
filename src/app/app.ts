import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
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
    this.translate.use('nl'); // Default fallback

    this.bootstrapActiveAccount();
  }

  private bootstrapActiveAccount(): void {
    // Note: Invoking the signal directly now, per our earlier refactor
    const activeAccount = this.accounts.usableActiveAccount();
    if (!activeAccount) return;

    this.authService.verifyToken(activeAccount.token).pipe(
      // 1. Sync the email to the registry
      tap(response => this.accounts.updateEmail(activeAccount.uid, response.email)),
      // 2. Fetch the user profile
      switchMap(() => this.userService.getProfile()),
      // 3. If anything fails (500s, or the Interceptor fails to refresh and throws), 
      // we gracefully catch it here so the app doesn't crash on boot.
      catchError(() => EMPTY) 
    ).subscribe(profile => {
      // 4. Update the language based on the authenticated profile
      const lang = profile?.preferredLanguage === 'en' ? 'en' : 'nl';
      this.translate.use(lang);
    });
  }
}