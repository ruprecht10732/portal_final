import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-personal-details',
  imports: [ButtonComponent, InputComponent, TranslatePipe],
  templateUrl: './personal-details.component.html',
  styleUrl: './personal-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDetailsComponent {
  protected readonly email = signal('');
  protected readonly initialEmail = signal('');
  protected readonly emailVerified = signal(false);
  protected readonly createdAt = signal('');
  protected readonly updatedAt = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly emailError = computed(() => {
    this.lang();
    const value = this.email();
    if (!value) return this.translate.instant('profile.personal.errors.emailRequired');
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : this.translate.instant('profile.personal.errors.emailInvalid');
  });

  protected readonly hasChanges = computed(() =>
    this.email().trim() !== this.initialEmail().trim()
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() && !this.emailError() && !!this.email() && this.hasChanges()
  );

  constructor() {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.userService
      .getProfile()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(profile => {
        this.email.set(profile.email);
        this.initialEmail.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.createdAt.set(profile.createdAt);
        this.updatedAt.set(profile.updatedAt);
      });
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

    this.userService
      .updateProfile({ email: this.email() })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(profile => {
        this.email.set(profile.email);
        this.initialEmail.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.updatedAt.set(profile.updatedAt);
        this.successMessage.set(this.translate.instant('profile.personal.success'));
      });
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'error' in error) {
      const value = (error as { error?: string }).error;
      if (value) return value;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const value = (error as { message?: string }).message;
      if (value) return value;
    }
    return this.translate.instant('profile.personal.errors.generic');
  }
}
