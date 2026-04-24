import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of, type Observable } from 'rxjs';
import { AgentApprovalsService } from '../../core/services/agent-approvals.service';
import type { AgentApproval } from '../../core/services/agent-approvals.types';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

const DECISION_CLASSES: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

@Component({
  selector: 'app-agent-approvals',
  imports: [
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    JsonPipe,
    LucideAngularModule,
    PageLayoutComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './agent-approvals.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-page-scroll block min-h-full xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-y-auto' },
})
export class AgentApprovalsComponent implements OnInit {
  private readonly approvalsService = inject(AgentApprovalsService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly approvals = signal<AgentApproval[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isProcessing = signal<string | null>(null);
  protected readonly errorMessage = signal('');

  protected readonly showRejectDialog = signal(false);
  protected readonly selectedApproval = signal<AgentApproval | null>(null);

  protected readonly hasPending = computed(() => this.approvals().length > 0);
  protected readonly processingId = computed(() =>
    this.isProcessing() && !this.showRejectDialog() ? this.isProcessing() : null
  );

  ngOnInit(): void {
    this.loadApprovals();
  }

  protected loadApprovals(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.approvalsService
      .listPending(50, 0)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
        catchError(() => {
          this.errorMessage.set(this.translate.instant('agentApprovals.loadFailed'));
          return of([]);
        }),
      )
      .subscribe((list) => {
        this.approvals.set(list);
      });
  }

  protected onApprove(approval: AgentApproval): void {
    this.processDecision(
      approval,
      (id) => this.approvalsService.approve(id),
      'agentApprovals.approved',
      'agentApprovals.approveFailed'
    );
  }

  protected onRejectClick(approval: AgentApproval): void {
    this.selectedApproval.set(approval);
    this.showRejectDialog.set(true);
  }

  protected onConfirmReject(): void {
    const approval = this.selectedApproval();
    if (!approval) return;

    this.showRejectDialog.set(false);
    this.processDecision(
      approval,
      (id) => this.approvalsService.reject(id),
      'agentApprovals.rejected',
      'agentApprovals.rejectFailed'
    );
  }

  protected onCancelReject(): void {
    this.showRejectDialog.set(false);
    this.selectedApproval.set(null);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString(this.translate.getCurrentLang() === 'nl' ? 'nl-NL' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  protected toolLabel(toolName: string): string {
    const key = `agentApprovals.tools.${toolName}`;
    const translated = this.translate.instant(key);
    return translated === key ? toolName : translated;
  }

  protected decisionClass(decision: string): string {
    return DECISION_CLASSES[decision] ?? 'bg-blue-100 text-blue-700';
  }

  private processDecision(
    approval: AgentApproval,
    action: (id: string) => Observable<unknown>,
    successKey: string,
    errorKey: string
  ): void {
    this.isProcessing.set(approval.id);

    action(approval.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isProcessing.set(null)),
        catchError(() => {
          this.toast.error(this.translate.instant(errorKey));
          return of(null);
        }),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant(successKey));
        this.removeApproval(approval.id);
        this.approvalsService.pendingCount.update((c) => Math.max(0, c - 1));
      });
  }

  private removeApproval(id: string): void {
    this.approvals.update((list) => list.filter((a) => a.id !== id));
  }
}
