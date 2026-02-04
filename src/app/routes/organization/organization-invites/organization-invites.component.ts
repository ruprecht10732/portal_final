import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { OrganizationInvite, OrganizationService } from '../../../core/services/organization.service';
import { DataGridComponent } from '../../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig, SelectionChangeEvent } from '../../../shared/components/data-grid/data-grid.types';
import { MOBILE_BREAKPOINT } from '../../../core/config';

type InviteStatus = 'used' | 'expired' | 'pending';
type InviteRow = OrganizationInvite & { status: InviteStatus; expiresAtDisplay: string } & Record<string, unknown>;

@Component({
  selector: 'app-organization-invites',
  imports: [ButtonComponent, RouterLink, TranslatePipe, DataGridComponent],
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
  protected readonly selectedInvite = signal<InviteRow | null>(null);

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly canResendSelected = computed(() => {
    const invite = this.selectedInvite();
    return !!invite && !this.isUsed(invite);
  });

  protected readonly statusOptions = computed(() => {
    this.lang();
    return [
      { label: this.translate.instant('organization.invite.statusPending'), value: 'pending' },
      { label: this.translate.instant('organization.invite.statusExpired'), value: 'expired' },
      { label: this.translate.instant('organization.invite.statusUsed'), value: 'used' },
    ];
  });

  protected readonly columns = computed<GridColumn<InviteRow>[]>(() => {
    this.lang();
    return [
      {
        id: 'email',
        header: this.translate.instant('organization.invite.columns.email'),
        field: 'email',
        sortable: false,
        filterable: false,
        width: '260px',
        cellType: 'text',
      },
      {
        id: 'status',
        header: this.translate.instant('organization.invite.columns.status'),
        field: 'status',
        sortable: false,
        filterable: false,
        width: '140px',
        cellType: 'select',
        selectOptions: this.statusOptions(),
      },
      {
        id: 'expiresAt',
        header: this.translate.instant('organization.invite.columns.expires'),
        field: 'expiresAtDisplay',
        sortable: false,
        filterable: false,
        width: '180px',
        cellType: 'text',
      },
    ];
  });

  protected readonly inviteRows = computed<InviteRow[]>(() => {
    this.lang();
    return this.invites().map(invite => ({
      ...invite,
      status: this.getStatusValue(invite),
      expiresAtDisplay: this.formatDate(invite.expiresAt),
    }));
  });

  protected readonly gridConfig: Partial<GridConfig<InviteRow>> = {
    rowIdField: 'id',
    selectable: true,
    multiSelect: false,
    cardViewEnabled: true,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    cardTitleField: 'email',
    cardSubtitleField: 'expiresAtDisplay',
    statusField: 'status',
    cardPreviewFieldCount: 3,
    mobileAddRowEnabled: false,
    rowViewActionEnabled: true,
    rowDeleteActionEnabled: true,
  };

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

  protected isExpired(invite: OrganizationInvite): boolean {
    if (invite.usedAt) return false;
    return new Date(invite.expiresAt).getTime() < Date.now();
  }

  protected isUsed(invite: OrganizationInvite): boolean {
    return !!invite.usedAt;
  }

  protected onSelectionChange(event: SelectionChangeEvent<InviteRow>): void {
    const selected = event.selectedRows[0] ?? null;
    this.selectedInvite.set(selected ?? null);
  }

  protected resendSelected(): void {
    const invite = this.selectedInvite();
    if (!invite || this.isUsed(invite)) return;
    this.resendInvite(invite);
  }

  protected onDeleteRows(rows: InviteRow[]): void {
    if (rows.length === 0) return;
    this.revokeInvite(rows[0]);
  }

  protected onRowDoubleClick(row: InviteRow): void {
    this.selectedInvite.set(row);
    this.router.navigate(['/app/organization/invites', row.id, 'edit']);
  }

  private getStatusValue(invite: OrganizationInvite): InviteStatus {
    if (this.isUsed(invite)) return 'used';
    if (this.isExpired(invite)) return 'expired';
    return 'pending';
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const locale = this.lang().lang || 'en';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
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
