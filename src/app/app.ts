import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of, take } from 'rxjs';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { TokenStorageService } from './core/services/token-storage.service';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly translate = inject(TranslateService);
  private readonly tokens = inject(TokenStorageService);
  private readonly userService = inject(UserService);

  constructor() {
    this.translate.addLangs(['en', 'nl']);
    this.translate.setFallbackLang('en');
    this.translate.use('nl');

    if (this.tokens.accessTokenValue) {
      this.userService
        .getProfile()
        .pipe(
          take(1),
          catchError(() =>
            of({
              id: '',
              email: '',
              emailVerified: false,
              firstName: null,
              lastName: null,
              preferredLanguage: 'nl',
              roles: [],
              createdAt: '',
              updatedAt: '',
            })
          )
        )
        .subscribe(profile => {
          const lang = profile.preferredLanguage === 'en' ? 'en' : 'nl';
          this.translate.use(lang);
        });
    }
  }
}
