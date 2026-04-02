import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { ProductFlow, ProductFlowService } from '../../../core/services/product-flow.service';

@Component({
  selector: 'app-product-flows',
  imports: [
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    LucideAngularModule,
    PageLayoutComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './product-flows.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class ProductFlowsComponent {
  private readonly flowService = inject(ProductFlowService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly flows = signal<ProductFlow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  // Delete dialog
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly pendingDeleteFlow = signal<ProductFlow | null>(null);
  protected readonly isDeleting = signal(false);

  // Duplicate
  protected readonly isDuplicating = signal(false);

  constructor() {
    this.loadFlows();
  }

  private loadFlows(): void {
    this.isLoading.set(true);
    this.flowService
      .list()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('productFlows.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => {
        this.flows.set(res.items ?? []);
      });
  }

  protected goToCreate(): void {
    this.router.navigate(['/app/settings/flows/new']);
  }

  protected goToEdit(flow: ProductFlow): void {
    this.router.navigate(['/app/settings/flows', flow.id, 'edit']);
  }

  protected openDeleteDialog(flow: ProductFlow): void {
    this.pendingDeleteFlow.set(flow);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleteDialogOpen.set(false);
    this.pendingDeleteFlow.set(null);
  }

  protected confirmDelete(): void {
    const flow = this.pendingDeleteFlow();
    if (!flow) return;

    this.isDeleting.set(true);
    this.flowService
      .delete(flow.id)
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('productFlows.deleteFailed'));
          return EMPTY;
        }),
        finalize(() => {
          this.isDeleting.set(false);
          this.closeDeleteDialog();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.successMessage.set(this.translate.instant('productFlows.deleted'));
        this.flows.update(list => list.filter(f => f.id !== flow.id));
      });
  }

  protected duplicateFlow(flow: ProductFlow): void {
    this.isDuplicating.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.flowService
      .duplicate(flow.id)
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('productFlows.duplicateFailed'));
          return EMPTY;
        }),
        finalize(() => this.isDuplicating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(created => {
        this.successMessage.set(this.translate.instant('productFlows.duplicated'));
        this.flows.update(list => [...list, created]);
      });
  }

  protected countSteps(flow: ProductFlow): number {
    const def = flow.definition as { steps?: unknown[] } | null;
    return def?.steps?.length ?? 0;
  }
}
