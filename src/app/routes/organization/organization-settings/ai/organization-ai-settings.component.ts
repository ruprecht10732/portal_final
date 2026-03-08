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
import { SelectComponent, type SelectOption } from '../../../../shared/components/select/select.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';

type CouncilConsensusMode = 'weighted' | 'majority' | 'estimator_final';

@Component({
  selector: 'app-organization-ai-settings',
  imports: [
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    NumberInputComponent,
    PageLayoutComponent,
    SelectComponent,
    SkeletonComponent,
    TextareaComponent,
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

  protected readonly aiConfidenceGateEnabled = signal(false);
  private readonly initialAiConfidenceGateEnabled = signal(false);

  protected readonly aiAdaptiveReasoningEnabled = signal(true);
  private readonly initialAiAdaptiveReasoningEnabled = signal(true);

  protected readonly aiExperienceMemoryEnabled = signal(true);
  private readonly initialAiExperienceMemoryEnabled = signal(true);

  protected readonly aiCouncilEnabled = signal(true);
  private readonly initialAiCouncilEnabled = signal(true);

  protected readonly aiCouncilConsensusMode = signal<CouncilConsensusMode>('weighted');
  private readonly initialAiCouncilConsensusMode = signal<CouncilConsensusMode>('weighted');

  protected readonly catalogGapThreshold = signal<number | null>(3);
  private readonly initialCatalogGapThreshold = signal(3);

  protected readonly catalogGapLookbackDays = signal<number | null>(30);
  private readonly initialCatalogGapLookbackDays = signal(30);

  protected readonly photoAnalysisPreprocessingEnabled = signal(true);
  private readonly initialPhotoAnalysisPreprocessingEnabled = signal(true);

  protected readonly photoAnalysisOcrAssistEnabled = signal(false);
  private readonly initialPhotoAnalysisOcrAssistEnabled = signal(false);

  protected readonly photoAnalysisOcrAssistServiceTypes = signal('');
  private readonly initialPhotoAnalysisOcrAssistServiceTypes = signal('');

  protected readonly photoAnalysisLensCorrectionEnabled = signal(false);
  private readonly initialPhotoAnalysisLensCorrectionEnabled = signal(false);

  protected readonly photoAnalysisLensCorrectionServiceTypes = signal('');
  private readonly initialPhotoAnalysisLensCorrectionServiceTypes = signal('');

  protected readonly photoAnalysisPerspectiveNormalizationEnabled = signal(false);
  private readonly initialPhotoAnalysisPerspectiveNormalizationEnabled = signal(false);

  protected readonly photoAnalysisPerspectiveNormalizationServiceTypes = signal('');
  private readonly initialPhotoAnalysisPerspectiveNormalizationServiceTypes = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly councilConsensusModeOptions = computed<SelectOption<CouncilConsensusMode>[]>(() => [
    { label: this.translate.instant('organization.settings.ai.councilConsensusModeWeighted'), value: 'weighted' as const },
    { label: this.translate.instant('organization.settings.ai.councilConsensusModeMajority'), value: 'majority' as const },
    { label: this.translate.instant('organization.settings.ai.councilConsensusModeEstimatorFinal'), value: 'estimator_final' as const },
  ]);

  protected readonly hasChanges = computed(() =>
    this.aiAutoDisqualifyJunk() !== this.initialAiAutoDisqualifyJunk() ||
    this.aiAutoDispatch() !== this.initialAiAutoDispatch() ||
    this.aiAutoEstimate() !== this.initialAiAutoEstimate() ||
    this.aiConfidenceGateEnabled() !== this.initialAiConfidenceGateEnabled() ||
    this.aiAdaptiveReasoningEnabled() !== this.initialAiAdaptiveReasoningEnabled() ||
    this.aiExperienceMemoryEnabled() !== this.initialAiExperienceMemoryEnabled() ||
    this.aiCouncilEnabled() !== this.initialAiCouncilEnabled() ||
    this.aiCouncilConsensusMode() !== this.initialAiCouncilConsensusMode() ||
    (this.catalogGapThreshold() ?? this.initialCatalogGapThreshold()) !== this.initialCatalogGapThreshold() ||
    (this.catalogGapLookbackDays() ?? this.initialCatalogGapLookbackDays()) !== this.initialCatalogGapLookbackDays() ||
    this.photoAnalysisPreprocessingEnabled() !== this.initialPhotoAnalysisPreprocessingEnabled() ||
    this.photoAnalysisOcrAssistEnabled() !== this.initialPhotoAnalysisOcrAssistEnabled() ||
    this.photoAnalysisOcrAssistServiceTypes() !== this.initialPhotoAnalysisOcrAssistServiceTypes() ||
    this.photoAnalysisLensCorrectionEnabled() !== this.initialPhotoAnalysisLensCorrectionEnabled() ||
    this.photoAnalysisLensCorrectionServiceTypes() !== this.initialPhotoAnalysisLensCorrectionServiceTypes() ||
    this.photoAnalysisPerspectiveNormalizationEnabled() !== this.initialPhotoAnalysisPerspectiveNormalizationEnabled() ||
    this.photoAnalysisPerspectiveNormalizationServiceTypes() !== this.initialPhotoAnalysisPerspectiveNormalizationServiceTypes()
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

        this.aiConfidenceGateEnabled.set(settings.aiConfidenceGateEnabled);
        this.initialAiConfidenceGateEnabled.set(settings.aiConfidenceGateEnabled);

        this.aiAdaptiveReasoningEnabled.set(settings.aiAdaptiveReasoningEnabled);
        this.initialAiAdaptiveReasoningEnabled.set(settings.aiAdaptiveReasoningEnabled);

        this.aiExperienceMemoryEnabled.set(settings.aiExperienceMemoryEnabled);
        this.initialAiExperienceMemoryEnabled.set(settings.aiExperienceMemoryEnabled);

        this.aiCouncilEnabled.set(settings.aiCouncilEnabled);
        this.initialAiCouncilEnabled.set(settings.aiCouncilEnabled);

        this.aiCouncilConsensusMode.set(settings.aiCouncilConsensusMode);
        this.initialAiCouncilConsensusMode.set(settings.aiCouncilConsensusMode);

        this.catalogGapThreshold.set(settings.catalogGapThreshold);
        this.initialCatalogGapThreshold.set(settings.catalogGapThreshold);

        this.catalogGapLookbackDays.set(settings.catalogGapLookbackDays);
        this.initialCatalogGapLookbackDays.set(settings.catalogGapLookbackDays);

        this.photoAnalysisPreprocessingEnabled.set(settings.photoAnalysisPreprocessingEnabled);
        this.initialPhotoAnalysisPreprocessingEnabled.set(settings.photoAnalysisPreprocessingEnabled);

        this.photoAnalysisOcrAssistEnabled.set(settings.photoAnalysisOcrAssistEnabled);
        this.initialPhotoAnalysisOcrAssistEnabled.set(settings.photoAnalysisOcrAssistEnabled);

        const ocrAssistServiceTypes = this.joinServiceTypes(settings.photoAnalysisOcrAssistServiceTypes);
        this.photoAnalysisOcrAssistServiceTypes.set(ocrAssistServiceTypes);
        this.initialPhotoAnalysisOcrAssistServiceTypes.set(ocrAssistServiceTypes);

        this.photoAnalysisLensCorrectionEnabled.set(settings.photoAnalysisLensCorrectionEnabled);
        this.initialPhotoAnalysisLensCorrectionEnabled.set(settings.photoAnalysisLensCorrectionEnabled);

        const lensCorrectionServiceTypes = this.joinServiceTypes(settings.photoAnalysisLensCorrectionServiceTypes);
        this.photoAnalysisLensCorrectionServiceTypes.set(lensCorrectionServiceTypes);
        this.initialPhotoAnalysisLensCorrectionServiceTypes.set(lensCorrectionServiceTypes);

        this.photoAnalysisPerspectiveNormalizationEnabled.set(settings.photoAnalysisPerspectiveNormalizationEnabled);
        this.initialPhotoAnalysisPerspectiveNormalizationEnabled.set(settings.photoAnalysisPerspectiveNormalizationEnabled);

        const perspectiveServiceTypes = this.joinServiceTypes(settings.photoAnalysisPerspectiveNormalizationServiceTypes);
        this.photoAnalysisPerspectiveNormalizationServiceTypes.set(perspectiveServiceTypes);
        this.initialPhotoAnalysisPerspectiveNormalizationServiceTypes.set(perspectiveServiceTypes);
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
        aiConfidenceGateEnabled: this.aiConfidenceGateEnabled(),
        aiAdaptiveReasoningEnabled: this.aiAdaptiveReasoningEnabled(),
        aiExperienceMemoryEnabled: this.aiExperienceMemoryEnabled(),
        aiCouncilEnabled: this.aiCouncilEnabled(),
        aiCouncilConsensusMode: this.aiCouncilConsensusMode(),
        ...(this.catalogGapThreshold() == null ? {} : { catalogGapThreshold: this.catalogGapThreshold()! }),
        ...(this.catalogGapLookbackDays() == null ? {} : { catalogGapLookbackDays: this.catalogGapLookbackDays()! }),
        photoAnalysisPreprocessingEnabled: this.photoAnalysisPreprocessingEnabled(),
        photoAnalysisOcrAssistEnabled: this.photoAnalysisOcrAssistEnabled(),
        photoAnalysisOcrAssistServiceTypes: this.parseServiceTypes(this.photoAnalysisOcrAssistServiceTypes()),
        photoAnalysisLensCorrectionEnabled: this.photoAnalysisLensCorrectionEnabled(),
        photoAnalysisLensCorrectionServiceTypes: this.parseServiceTypes(this.photoAnalysisLensCorrectionServiceTypes()),
        photoAnalysisPerspectiveNormalizationEnabled: this.photoAnalysisPerspectiveNormalizationEnabled(),
        photoAnalysisPerspectiveNormalizationServiceTypes: this.parseServiceTypes(this.photoAnalysisPerspectiveNormalizationServiceTypes()),
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

        this.aiConfidenceGateEnabled.set(settings.aiConfidenceGateEnabled);
        this.initialAiConfidenceGateEnabled.set(settings.aiConfidenceGateEnabled);

        this.aiAdaptiveReasoningEnabled.set(settings.aiAdaptiveReasoningEnabled);
        this.initialAiAdaptiveReasoningEnabled.set(settings.aiAdaptiveReasoningEnabled);

        this.aiExperienceMemoryEnabled.set(settings.aiExperienceMemoryEnabled);
        this.initialAiExperienceMemoryEnabled.set(settings.aiExperienceMemoryEnabled);

        this.aiCouncilEnabled.set(settings.aiCouncilEnabled);
        this.initialAiCouncilEnabled.set(settings.aiCouncilEnabled);

        this.aiCouncilConsensusMode.set(settings.aiCouncilConsensusMode);
        this.initialAiCouncilConsensusMode.set(settings.aiCouncilConsensusMode);

        this.catalogGapThreshold.set(settings.catalogGapThreshold);
        this.initialCatalogGapThreshold.set(settings.catalogGapThreshold);

        this.catalogGapLookbackDays.set(settings.catalogGapLookbackDays);
        this.initialCatalogGapLookbackDays.set(settings.catalogGapLookbackDays);

        this.photoAnalysisPreprocessingEnabled.set(settings.photoAnalysisPreprocessingEnabled);
        this.initialPhotoAnalysisPreprocessingEnabled.set(settings.photoAnalysisPreprocessingEnabled);

        this.photoAnalysisOcrAssistEnabled.set(settings.photoAnalysisOcrAssistEnabled);
        this.initialPhotoAnalysisOcrAssistEnabled.set(settings.photoAnalysisOcrAssistEnabled);

        const ocrAssistServiceTypes = this.joinServiceTypes(settings.photoAnalysisOcrAssistServiceTypes);
        this.photoAnalysisOcrAssistServiceTypes.set(ocrAssistServiceTypes);
        this.initialPhotoAnalysisOcrAssistServiceTypes.set(ocrAssistServiceTypes);

        this.photoAnalysisLensCorrectionEnabled.set(settings.photoAnalysisLensCorrectionEnabled);
        this.initialPhotoAnalysisLensCorrectionEnabled.set(settings.photoAnalysisLensCorrectionEnabled);

        const lensCorrectionServiceTypes = this.joinServiceTypes(settings.photoAnalysisLensCorrectionServiceTypes);
        this.photoAnalysisLensCorrectionServiceTypes.set(lensCorrectionServiceTypes);
        this.initialPhotoAnalysisLensCorrectionServiceTypes.set(lensCorrectionServiceTypes);

        this.photoAnalysisPerspectiveNormalizationEnabled.set(settings.photoAnalysisPerspectiveNormalizationEnabled);
        this.initialPhotoAnalysisPerspectiveNormalizationEnabled.set(settings.photoAnalysisPerspectiveNormalizationEnabled);

        const perspectiveServiceTypes = this.joinServiceTypes(settings.photoAnalysisPerspectiveNormalizationServiceTypes);
        this.photoAnalysisPerspectiveNormalizationServiceTypes.set(perspectiveServiceTypes);
        this.initialPhotoAnalysisPerspectiveNormalizationServiceTypes.set(perspectiveServiceTypes);

        this.successMessage.set(this.translate.instant('organization.settings.ai.saved'));
      });
  }

  private parseServiceTypes(value: string): string[] {
    return value
      .split(/\r?\n|,/) 
      .map(item => item.trim())
      .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index);
  }

  private joinServiceTypes(values: string[] | null | undefined): string {
    return (values ?? []).join('\n');
  }
}
