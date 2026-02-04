import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { OrganizationInvite, OrganizationService } from '../../../core/services/organization.service';
import { OrganizationInviteFormComponent } from '../organization-invite-form/organization-invite-form.component';

@Component({
  selector: 'app-organization-invite-edit',
  imports: [ButtonComponent, TranslatePipe, DatePipe, OrganizationInviteFormComponent],
  templateUrl: './organization-invite-edit.component.html',
  styleUrl: './organization-invite-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationInviteEditComponent {
  protected readonly inviteId = signal('');
  protected readonly email = signal('');
  protected readonly initialEmail = signal('');
  protected readonly expiresAt = signal('');
  protected readonly usedAt = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly inviteToken = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : this.translate.instant('organization.errors.emailInvalid');
  });

  protected readonly hasChanges = computed(() =>
    this.email().trim() !== this.initialEmail().trim()
  );

  protected readonly isUsed = computed(() => !!this.usedAt());

  protected readonly isExpired = computed(() => {
    if (this.usedAt()) return false;
    const value = this.expiresAt();
    if (!value) return false;
    return new Date(value).getTime() < Date.now();
  });

  protected readonly canSave = computed(() =>
    !this.isSaving() && !!this.email().trim() && !this.emailError() && this.hasChanges()
  );

  protected readonly canResend = computed(() => !this.isSaving() && !this.isUsed());

  constructor() {
    this.loadInvite();
  }

  private loadInvite(): void {
    const inviteId = this.route.snapshot.paramMap.get('inviteId');
    if (!inviteId) {
      this.isLoading.set(false);
      this.errorMessage.set(this.translate.instant('organization.errors.generic'));
      return;
    }

    this.inviteId.set(inviteId);
    this.isLoading.set(true);

    this.orgService
      .listInvites()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(invites => {
        const invite = invites.find(item => item.id === inviteId);
        if (!invite) {
          this.errorMessage.set(this.translate.instant('organization.errors.generic'));
          return;
        }
        this.applyInvite(invite);
      });
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.inviteToken.set('');

    this.orgService
      .updateInvite(this.inviteId(), { email: this.email().trim() })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.applyInvite(response.invite);
        this.successMessage.set(this.translate.instant('organization.invite.sent'));
      });
  }

  protected resend(): void {
    if (!this.canResend()) return;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.inviteToken.set('');

    this.orgService
      .updateInvite(this.inviteId(), { resend: true })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.applyInvite(response.invite);
        if (response.token) {
          this.inviteToken.set(response.token);
        }
        this.successMessage.set(this.translate.instant('organization.invite.sent'));
      });
  }

  protected revoke(): void {
    if (this.isSaving() || this.isUsed()) return;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.orgService
      .revokeInvite(this.inviteId())
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(invite => {
        this.applyInvite(invite);
        this.successMessage.set(this.translate.instant('organization.invite.statusExpired'));
      });
  }

  private applyInvite(invite: OrganizationInvite): void {
    this.email.set(invite.email);
    this.initialEmail.set(invite.email);
    this.expiresAt.set(invite.expiresAt);
    this.usedAt.set(invite.usedAt ?? null);
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
    return this.translate.instant('organization.errors.generic');
  }
}
