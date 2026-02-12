import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  NotificationWorkflowRule,
  OrganizationService,
} from '../../../../core/services/organization.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CheckboxComponent } from '../../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';

type WorkflowTrigger =
  | 'lead_welcome'
  | 'quote_sent'
  | 'appointment_created'
  | 'appointment_reminder'
  | 'partner_offer_created';

interface WorkflowCardConfig {
  trigger: WorkflowTrigger;
  audience: 'lead' | 'partner';
  titleKey: string;
  hintKey: string;
  varsKey: string;
  supportsLeadSource: boolean;
}

interface WorkflowFormState {
  enabled: boolean;
  delayMinutes: number;
  leadSource: string;
  templateText: string;
}

@Component({
  selector: 'app-organization-workflows-settings',
  imports: [
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    PageLayoutComponent,
    SkeletonComponent,
    TextareaComponent,
    TranslatePipe,
  ],
  templateUrl: './organization-workflows-settings.component.html',
  styleUrl: './organization-workflows-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationWorkflowsSettingsComponent {
  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  private readonly initialSnapshot = signal('');
  protected readonly workflows = signal<Record<WorkflowTrigger, WorkflowFormState>>(this.defaultState());

  protected readonly cards: readonly WorkflowCardConfig[] = [
    {
      trigger: 'lead_welcome',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.leadWelcome.title',
      hintKey: 'organization.settings.workflows.cards.leadWelcome.hint',
      varsKey: 'organization.settings.workflows.cards.leadWelcome.vars',
      supportsLeadSource: true,
    },
    {
      trigger: 'quote_sent',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteSent.title',
      hintKey: 'organization.settings.workflows.cards.quoteSent.hint',
      varsKey: 'organization.settings.workflows.cards.quoteSent.vars',
      supportsLeadSource: true,
    },
    {
      trigger: 'appointment_created',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentCreated.title',
      hintKey: 'organization.settings.workflows.cards.appointmentCreated.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentCreated.vars',
      supportsLeadSource: false,
    },
    {
      trigger: 'appointment_reminder',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentReminder.title',
      hintKey: 'organization.settings.workflows.cards.appointmentReminder.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentReminder.vars',
      supportsLeadSource: false,
    },
    {
      trigger: 'partner_offer_created',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.partnerOfferCreated.title',
      hintKey: 'organization.settings.workflows.cards.partnerOfferCreated.hint',
      varsKey: 'organization.settings.workflows.cards.partnerOfferCreated.vars',
      supportsLeadSource: false,
    },
  ];

  protected readonly hasChanges = computed(() => this.initialSnapshot() !== JSON.stringify(this.workflows()));
  protected readonly canSave = computed(() => !this.isSaving() && this.hasChanges());

  constructor() {
    this.load();
  }

  private defaultState(): Record<WorkflowTrigger, WorkflowFormState> {
    return {
      lead_welcome: { enabled: true, delayMinutes: 0, leadSource: '', templateText: '' },
      quote_sent: { enabled: true, delayMinutes: 0, leadSource: '', templateText: '' },
      appointment_created: { enabled: true, delayMinutes: 0, leadSource: '', templateText: '' },
      appointment_reminder: { enabled: true, delayMinutes: 0, leadSource: '', templateText: '' },
      partner_offer_created: { enabled: true, delayMinutes: 0, leadSource: '', templateText: '' },
    };
  }

  private load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getNotificationWorkflows()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.workflows.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(rules => {
        this.applyRules(rules);
      });
  }

  private applyRules(rules: NotificationWorkflowRule[]): void {
    const next = this.defaultState();
    for (const rule of rules) {
      if (rule.channel !== 'whatsapp') continue;
      const trigger = rule.trigger as WorkflowTrigger;
      if (!(trigger in next)) continue;

      next[trigger] = {
        enabled: !!rule.enabled,
        delayMinutes: rule.delayMinutes ?? 0,
        leadSource: rule.leadSource ?? '',
        templateText: rule.templateText ?? '',
      };
    }
    this.workflows.set(next);
    this.initialSnapshot.set(JSON.stringify(next));
  }

  protected updateEnabled(trigger: WorkflowTrigger, enabled: boolean): void {
    this.workflows.update(current => ({
      ...current,
      [trigger]: { ...current[trigger], enabled },
    }));
  }

  protected updateDelay(trigger: WorkflowTrigger, delayMinutes: number | null): void {
    this.workflows.update(current => ({
      ...current,
      [trigger]: { ...current[trigger], delayMinutes: delayMinutes ?? 0 },
    }));
  }

  protected updateLeadSource(trigger: WorkflowTrigger, leadSource: string): void {
    this.workflows.update(current => ({
      ...current,
      [trigger]: { ...current[trigger], leadSource },
    }));
  }

  protected updateTemplate(trigger: WorkflowTrigger, templateText: string): void {
    this.workflows.update(current => ({
      ...current,
      [trigger]: { ...current[trigger], templateText },
    }));
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payloadRules: NotificationWorkflowRule[] = this.cards.map(card => {
      const state = this.workflows()[card.trigger];
      return {
        trigger: card.trigger,
        channel: 'whatsapp',
        audience: card.audience,
        enabled: state.enabled,
        delayMinutes: state.delayMinutes ?? 0,
        leadSource: state.leadSource.trim() ? state.leadSource.trim() : null,
        templateText: state.templateText.trim() ? state.templateText : null,
      };
    });

    this.orgService
      .replaceNotificationWorkflows({ workflows: payloadRules })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.workflows.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(rules => {
        this.applyRules(rules);
        this.successMessage.set(this.translate.instant('organization.settings.workflows.saved'));
      });
  }
}
