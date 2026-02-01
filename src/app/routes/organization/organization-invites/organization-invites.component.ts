import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { OrganizationInvite, OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'app-organization-invites',
  imports: [ButtonComponent, RouterLink, TranslatePipe, DatePipe],
  templateUrl: './organization-invites.component.html',
  styleUrl: './organization-invites.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationInvitesComponent {
  protected readonly invites = signal<OrganizationInvite[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly tokenMessage = signal('');
  protected readonly tokenEmail = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly hasInvites = computed(() => this.invites().length > 0);

  constructor() {
    this.loadInvites();
  }

  protected loadInvites(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

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
      .subscribe(invites => this.invites.set(invites));
  }

  protected resendInvite(invite: OrganizationInvite): void {
    if (this.isSaving() || this.isUsed(invite)) return;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.tokenMessage.set('');
    this.tokenEmail.set('');

    this.orgService
      .updateInvite(invite.id, { resend: true })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        const nextInvites = this.invites().map(item => item.id === invite.id ? response.invite : item);
        this.invites.set(nextInvites);
        if (response.token) {
          this.tokenMessage.set(response.token);
          this.tokenEmail.set(response.invite.email);
        }
      });
  }

  protected revokeInvite(invite: OrganizationInvite): void {
    if (this.isSaving() || this.isUsed(invite)) return;
    this.isSaving.set(true);
    this.errorMessage.set('');

    this.orgService
      .revokeInvite(invite.id)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        const nextInvites = this.invites().map(item => item.id === invite.id ? response : item);
        this.invites.set(nextInvites);
      });
  }

  protected statusLabel(invite: OrganizationInvite): string {
    if (this.isUsed(invite)) return this.translate.instant('organization.invite.statusUsed');
    if (this.isExpired(invite)) return this.translate.instant('organization.invite.statusExpired');
    return this.translate.instant('organization.invite.statusPending');
  }

  protected isExpired(invite: OrganizationInvite): boolean {
    if (invite.usedAt) return false;
    return new Date(invite.expiresAt).getTime() < Date.now();
  }

  protected isUsed(invite: OrganizationInvite): boolean {
    return !!invite.usedAt;
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
