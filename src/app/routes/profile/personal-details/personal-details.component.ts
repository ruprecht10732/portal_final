import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, of, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'app-personal-details',
  imports: [ButtonComponent, InputComponent, SelectComponent, TranslatePipe],
  templateUrl: './personal-details.component.html',
  styleUrl: './personal-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDetailsComponent {
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly initialFirstName = signal('');
  protected readonly initialLastName = signal('');
  protected readonly preferredLanguage = signal<'en' | 'nl'>('nl');
  protected readonly initialPreferredLanguage = signal<'en' | 'nl'>('nl');
  protected readonly email = signal('');
  protected readonly initialEmail = signal('');
  protected readonly emailVerified = signal(false);
  protected readonly createdAt = signal('');
  protected readonly updatedAt = signal('');
  protected readonly roles = signal<string[]>([]);
  protected readonly organizationName = signal('');
  protected readonly initialOrganizationName = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly userService = inject(UserService);
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly languageOptions = computed<readonly SelectOption<'en' | 'nl'>[]>(() => {
    this.lang();
    return [
      { label: this.translate.instant('profile.personal.languageEnglish'), value: 'en' },
      { label: this.translate.instant('profile.personal.languageDutch'), value: 'nl' },
    ];
  });

  protected readonly emailError = computed(() => {
    this.lang();
    const value = this.email();
    if (!value) return this.translate.instant('profile.personal.errors.emailRequired');
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : this.translate.instant('profile.personal.errors.emailInvalid');
  });

  protected readonly firstNameError = computed(() => {
    this.lang();
    const value = this.firstName().trim();
    if (!value) return '';
    return value.length <= 100
      ? ''
      : this.translate.instant('profile.personal.errors.firstNameMax');
  });

  protected readonly lastNameError = computed(() => {
    this.lang();
    const value = this.lastName().trim();
    if (!value) return '';
    return value.length <= 100
      ? ''
      : this.translate.instant('profile.personal.errors.lastNameMax');
  });

  protected readonly organizationNameError = computed(() => {
    this.lang();
    if (!this.isAdmin()) return '';
    return this.organizationName().trim()
      ? ''
      : this.translate.instant('profile.personal.errors.organizationRequired');
  });

  protected readonly hasChanges = computed(() =>
    this.email().trim() !== this.initialEmail().trim() ||
    this.firstName().trim() !== this.initialFirstName().trim() ||
    this.lastName().trim() !== this.initialLastName().trim() ||
    this.preferredLanguage() !== this.initialPreferredLanguage() ||
    (this.isAdmin() && this.organizationName().trim() !== this.initialOrganizationName().trim())
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    !this.emailError() &&
    !this.firstNameError() &&
    !this.lastNameError() &&
    !this.organizationNameError() &&
    !!this.email() &&
    this.hasChanges()
  );

  protected readonly isAdmin = computed(() => this.roles().includes('admin'));

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
        const first = profile.firstName ?? '';
        const last = profile.lastName ?? '';
        this.email.set(profile.email);
        this.initialEmail.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.roles.set(profile.roles ?? []);
        this.firstName.set(first);
        this.lastName.set(last);
        this.initialFirstName.set(first);
        this.initialLastName.set(last);
        this.preferredLanguage.set(profile.preferredLanguage === 'en' ? 'en' : 'nl');
        this.initialPreferredLanguage.set(profile.preferredLanguage === 'en' ? 'en' : 'nl');
        this.createdAt.set(profile.createdAt);
        this.updatedAt.set(profile.updatedAt);

        if (profile.roles.includes('admin')) {
          this.organizationService
            .getOrganization()
            .pipe(
              catchError(() => EMPTY),
              takeUntilDestroyed(this.destroyRef)
            )
                .subscribe(org => {
                  this.organizationName.set(org.name);
                  this.initialOrganizationName.set(org.name);
                });
        }
      });
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

    this.userService
      .updateProfile({
        email: this.email(),
        firstName: this.firstName().trim() || null,
        lastName: this.lastName().trim() || null,
        preferredLanguage: this.preferredLanguage(),
      })
      .pipe(
            switchMap(profile => {
              if (!this.isAdmin()) {
                return of({ profile, org: null as { name: string } | null });
              }

              const orgName = this.organizationName().trim();
              if (!orgName) {
                return of({ profile, org: null as { name: string } | null });
              }
              if (orgName === this.initialOrganizationName().trim()) {
                return of({ profile, org: null as { name: string } | null });
              }

              return this.organizationService.updateOrganization({ name: orgName }).pipe(
                switchMap(org => of({ profile, org }))
              );
            }),
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
          .subscribe(({ profile, org }) => {
        const first = profile.firstName ?? '';
        const last = profile.lastName ?? '';
        this.email.set(profile.email);
        this.initialEmail.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.firstName.set(first);
        this.lastName.set(last);
        this.initialFirstName.set(first);
        this.initialLastName.set(last);
        this.preferredLanguage.set(profile.preferredLanguage === 'en' ? 'en' : 'nl');
        this.initialPreferredLanguage.set(profile.preferredLanguage === 'en' ? 'en' : 'nl');
        this.updatedAt.set(profile.updatedAt);
            if (org) {
              this.organizationName.set(org.name);
              this.initialOrganizationName.set(org.name);
            }
        this.successMessage.set(this.translate.instant('profile.personal.success'));
        this.translate.use(this.preferredLanguage());
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
