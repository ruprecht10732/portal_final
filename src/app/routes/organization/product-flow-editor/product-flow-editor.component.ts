import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { ProductFlowService } from '../../../core/services/product-flow.service';
import { FlowBuilderComponent } from './flow-builder/flow-builder.component';
import { type FlowDefinition, createEmptyDefinition } from './flow-builder/flow-builder.types';

@Component({
  selector: 'app-product-flow-editor',
  imports: [
    ButtonComponent,
    CardComponent,
    FlowBuilderComponent,
    FormsModule,
    InputComponent,
    PageLayoutComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './product-flow-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class ProductFlowEditorComponent {
  private readonly flowService = inject(ProductFlowService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly isEditMode = signal(false);
  protected readonly flowId = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly productGroupId = signal('');
  protected readonly definitionJson = signal('');
  protected readonly flowDefinition = signal<FlowDefinition>(createEmptyDefinition());
  protected readonly definitionReady = signal(false);

  protected readonly jsonError = computed(() => {
    return null;
  });

  protected readonly canSave = computed(() => {
    return this.productGroupId().trim().length > 0
      && this.definitionReady()
      && !this.isSaving();
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.flowId.set(id);
      this.loadFlow(id);
    } else {
      this.definitionReady.set(true);
    }
  }

  private loadFlow(id: string): void {
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
        const flow = (res.items ?? []).find(f => f.id === id);
        if (!flow) {
          this.errorMessage.set(this.translate.instant('productFlows.notFound'));
          return;
        }
        this.productGroupId.set(flow.productGroupId);
        const def = (flow.editorDefinition ?? flow.definition) as FlowDefinition;
        if (!def.settings) {
          def.settings = { productGroup: '', summaryTitle: 'Samenvatting' };
        }
        this.definitionJson.set(JSON.stringify(def, null, 2));
        this.flowDefinition.set(def);
        this.definitionReady.set(true);
      });
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const definition = this.flowDefinition();

    const request$ = this.isEditMode()
      ? this.flowService.update(this.flowId()!, { editorDefinition: definition })
      : this.flowService.create({ productGroupId: this.productGroupId().trim(), editorDefinition: definition, definition: {} });

    request$
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('productFlows.editor.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.router.navigate(['/app/settings/flows']);
      });
  }

  protected cancel(): void {
    this.router.navigate(['/app/settings/flows']);
  }
}
