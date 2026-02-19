import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrganizationService } from '../../../../core/services/organization.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CheckboxComponent } from '../../../../shared/components/checkbox/checkbox.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-organization-ai-settings',
  imports: [
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    NumberInputComponent,
    PageLayoutComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './organization-ai-settings.component.html',
  styleUrl: './organization-ai-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationAiSettingsComponent {
  protected readonly aiAutoDisqualifyJunk = signal(true);
  private readonly initialAiAutoDisqualifyJunk = signal(true);

  protected readonly aiAutoDispatch = signal(false);
  private readonly initialAiAutoDispatch = signal(false);

  protected readonly aiAutoEstimate = signal(true);
  private readonly initialAiAutoEstimate = signal(true);

  protected readonly catalogGapThreshold = signal<number | null>(3);
  private readonly initialCatalogGapThreshold = signal(3);

  protected readonly catalogGapLookbackDays = signal<number | null>(30);
  private readonly initialCatalogGapLookbackDays = signal(30);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly hasChanges = computed(() =>
    this.aiAutoDisqualifyJunk() !== this.initialAiAutoDisqualifyJunk() ||
    this.aiAutoDispatch() !== this.initialAiAutoDispatch() ||
    this.aiAutoEstimate() !== this.initialAiAutoEstimate() ||
    (this.catalogGapThreshold() ?? this.initialCatalogGapThreshold()) !== this.initialCatalogGapThreshold() ||
    (this.catalogGapLookbackDays() ?? this.initialCatalogGapLookbackDays()) !== this.initialCatalogGapLookbackDays()
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    this.hasChanges() &&
    (this.catalogGapThreshold() ?? 0) >= 1 &&
    (this.catalogGapLookbackDays() ?? 0) >= 1
  );

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getSettings()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.ai.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.aiAutoDisqualifyJunk.set(settings.aiAutoDisqualifyJunk);
        this.initialAiAutoDisqualifyJunk.set(settings.aiAutoDisqualifyJunk);

        this.aiAutoDispatch.set(settings.aiAutoDispatch);
        this.initialAiAutoDispatch.set(settings.aiAutoDispatch);

        this.aiAutoEstimate.set(settings.aiAutoEstimate);
        this.initialAiAutoEstimate.set(settings.aiAutoEstimate);

        this.catalogGapThreshold.set(settings.catalogGapThreshold);
        this.initialCatalogGapThreshold.set(settings.catalogGapThreshold);

        this.catalogGapLookbackDays.set(settings.catalogGapLookbackDays);
        this.initialCatalogGapLookbackDays.set(settings.catalogGapLookbackDays);
      });
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.orgService
      .updateSettings({
        aiAutoDisqualifyJunk: this.aiAutoDisqualifyJunk(),
        aiAutoDispatch: this.aiAutoDispatch(),
        aiAutoEstimate: this.aiAutoEstimate(),
        ...(this.catalogGapThreshold() == null ? {} : { catalogGapThreshold: this.catalogGapThreshold()! }),
        ...(this.catalogGapLookbackDays() == null ? {} : { catalogGapLookbackDays: this.catalogGapLookbackDays()! }),
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.ai.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.aiAutoDisqualifyJunk.set(settings.aiAutoDisqualifyJunk);
        this.initialAiAutoDisqualifyJunk.set(settings.aiAutoDisqualifyJunk);

        this.aiAutoDispatch.set(settings.aiAutoDispatch);
        this.initialAiAutoDispatch.set(settings.aiAutoDispatch);

        this.aiAutoEstimate.set(settings.aiAutoEstimate);
        this.initialAiAutoEstimate.set(settings.aiAutoEstimate);

        this.catalogGapThreshold.set(settings.catalogGapThreshold);
        this.initialCatalogGapThreshold.set(settings.catalogGapThreshold);

        this.catalogGapLookbackDays.set(settings.catalogGapLookbackDays);
        this.initialCatalogGapLookbackDays.set(settings.catalogGapLookbackDays);

        this.successMessage.set(this.translate.instant('organization.settings.ai.saved'));
      });
  }
}
