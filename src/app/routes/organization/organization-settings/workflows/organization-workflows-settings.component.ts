import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, forkJoin, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  type UpsertWorkflowAssignmentRuleRequest,
  type UpsertWorkflowRequest,
  type UpsertWorkflowStepRequest,
  type WorkflowAssignmentRule,
  type WorkflowEngineWorkflow,
  type WorkflowStep,
  OrganizationService,
} from '../../../../core/services/organization.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CheckboxComponent } from '../../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { RichTextEditorComponent, type TemplateVariable } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { SelectComponent, type SelectOption } from '../../../../shared/components/select/select.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TabBarComponent, type TabItem } from '../../../../shared/components/tab-bar/tab-bar.component';

type WorkflowTrigger =
  | 'lead_welcome'
  | 'quote_sent'
  | 'quote_question_asked'
  | 'quote_question_answered'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'appointment_created'
  | 'appointment_reminder'
  | 'partner_offer_created'
  | 'job_completed';

type WorkflowChannel = 'whatsapp' | 'email';
type WorkflowAudience = 'lead' | 'partner';

type WorkflowCardKey =
  | 'lead_welcome_whatsapp_lead'
  | 'lead_welcome_email_lead'
  | 'quote_sent_whatsapp_lead'
  | 'quote_sent_email_lead'
  | 'quote_question_asked_whatsapp_partner'
  | 'quote_question_asked_email_partner'
  | 'quote_question_answered_whatsapp_lead'
  | 'quote_question_answered_email_lead'
  | 'quote_accepted_whatsapp_lead'
  | 'quote_accepted_email_lead'
  | 'quote_accepted_email_partner'
  | 'quote_rejected_whatsapp_lead'
  | 'quote_rejected_email_lead'
  | 'appointment_created_whatsapp_lead'
  | 'appointment_created_email_lead'
  | 'appointment_reminder_whatsapp_lead'
  | 'appointment_reminder_email_lead'
  | 'partner_offer_created_whatsapp_partner'
  | 'partner_offer_created_email_partner'
  | 'job_completed_whatsapp_lead'
  | 'job_completed_email_lead';

interface WorkflowCardConfig {
  key: WorkflowCardKey;
  trigger: WorkflowTrigger;
  channel: WorkflowChannel;
  audience: WorkflowAudience;
  titleKey: string;
  noteKey?: string;
  hintKey: string;
  varsKey: string;
}

interface WorkflowFormState {
  enabled: boolean;
  delayMinutes: number;
  templateSubject: string;
  templateText: string;
}

interface WorkflowProfileState {
  id?: string;
  workflowKey: string;
  name: string;
  enabled: boolean;
  cards: Record<WorkflowCardKey, WorkflowFormState>;
}

interface WorkflowChannelConfig {
  cardKeys: WorkflowCardKey[];
  hintKey: string;
  varsKey: string;
}

interface WorkflowActionConfig {
  id: WorkflowTrigger;
  titleKey: string;
  channels: Partial<Record<WorkflowChannel, WorkflowChannelConfig>>;
}

interface WorkflowSelectedChannelCardState {
  key: WorkflowCardKey;
  titleKey: string;
  noteKey?: string;
  hintKey: string;
  varsKey: string;
  state: WorkflowFormState;
}

@Component({
  selector: 'app-organization-workflows-settings',
  imports: [
    ButtonComponent,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    PageLayoutComponent,
    RichTextEditorComponent,
    SelectComponent,
    SkeletonComponent,
    TabBarComponent,
    TranslatePipe,
  ],
  templateUrl: './organization-workflows-settings.component.html',
  styleUrl: './organization-workflows-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
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
  private readonly workflowProfiles = signal<WorkflowProfileState[]>([]);
  private readonly assignmentRules = signal<WorkflowAssignmentRule[]>([]);

  protected readonly selectedWorkflowKey = signal('');
  protected readonly selectedDefaultWorkflowKey = signal('');
  protected readonly selectedAction = signal<WorkflowTrigger>('lead_welcome');
  protected readonly selectedChannel = signal<WorkflowChannel>('whatsapp');

  protected readonly channelTabs = computed<TabItem[]>(() => [
    { id: 'whatsapp', label: this.translate.instant('organization.settings.workflows.whatsappColumnTitle') },
    { id: 'email', label: this.translate.instant('organization.settings.workflows.emailColumnTitle') },
  ]);

  protected readonly actionOptions = computed<SelectOption<WorkflowTrigger>[]>(() =>
    this.actions.map(action => ({
      value: action.id,
      label: this.translate.instant(action.titleKey),
    }))
  );

  protected readonly cards: readonly WorkflowCardConfig[] = [
    {
      key: 'lead_welcome_whatsapp_lead',
      trigger: 'lead_welcome',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.leadWelcome.title',
      hintKey: 'organization.settings.workflows.cards.leadWelcome.hint',
      varsKey: 'organization.settings.workflows.cards.leadWelcome.vars',
    },
    {
      key: 'lead_welcome_email_lead',
      trigger: 'lead_welcome',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.leadWelcome.title',
      hintKey: 'organization.settings.workflows.cards.leadWelcome.hint',
      varsKey: 'organization.settings.workflows.cards.leadWelcome.vars',
    },
    {
      key: 'quote_sent_whatsapp_lead',
      trigger: 'quote_sent',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteSent.title',
      hintKey: 'organization.settings.workflows.cards.quoteSent.hint',
      varsKey: 'organization.settings.workflows.cards.quoteSent.vars',
    },
    {
      key: 'quote_sent_email_lead',
      trigger: 'quote_sent',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteSent.title',
      hintKey: 'organization.settings.workflows.cards.quoteSent.hint',
      varsKey: 'organization.settings.workflows.cards.quoteSent.vars',
    },
    {
      key: 'quote_question_asked_whatsapp_partner',
      trigger: 'quote_question_asked',
      channel: 'whatsapp',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.title',
      noteKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.note',
      hintKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.hint',
      varsKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.vars',
    },
    {
      key: 'quote_question_asked_email_partner',
      trigger: 'quote_question_asked',
      channel: 'email',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerEmail.title',
      hintKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerEmail.hint',
      varsKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerEmail.vars',
    },
    {
      key: 'quote_question_answered_whatsapp_lead',
      trigger: 'quote_question_answered',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadWhatsApp.title',
      hintKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadWhatsApp.hint',
      varsKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadWhatsApp.vars',
    },
    {
      key: 'quote_question_answered_email_lead',
      trigger: 'quote_question_answered',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadEmail.title',
      hintKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadEmail.hint',
      varsKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadEmail.vars',
    },
    {
      key: 'quote_accepted_whatsapp_lead',
      trigger: 'quote_accepted',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteAcceptedLeadWhatsApp.title',
      hintKey: 'organization.settings.workflows.cards.quoteAcceptedLeadWhatsApp.hint',
      varsKey: 'organization.settings.workflows.cards.quoteAcceptedLeadWhatsApp.vars',
    },
    {
      key: 'quote_accepted_email_lead',
      trigger: 'quote_accepted',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteAcceptedLeadEmail.title',
      hintKey: 'organization.settings.workflows.cards.quoteAcceptedLeadEmail.hint',
      varsKey: 'organization.settings.workflows.cards.quoteAcceptedLeadEmail.vars',
    },
    {
      key: 'quote_accepted_email_partner',
      trigger: 'quote_accepted',
      channel: 'email',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.quoteAcceptedPartnerEmail.title',
      hintKey: 'organization.settings.workflows.cards.quoteAcceptedPartnerEmail.hint',
      varsKey: 'organization.settings.workflows.cards.quoteAcceptedPartnerEmail.vars',
    },
    {
      key: 'quote_rejected_whatsapp_lead',
      trigger: 'quote_rejected',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteRejectedLeadWhatsApp.title',
      hintKey: 'organization.settings.workflows.cards.quoteRejectedLeadWhatsApp.hint',
      varsKey: 'organization.settings.workflows.cards.quoteRejectedLeadWhatsApp.vars',
    },
    {
      key: 'quote_rejected_email_lead',
      trigger: 'quote_rejected',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.quoteRejectedLeadEmail.title',
      hintKey: 'organization.settings.workflows.cards.quoteRejectedLeadEmail.hint',
      varsKey: 'organization.settings.workflows.cards.quoteRejectedLeadEmail.vars',
    },
    {
      key: 'appointment_created_whatsapp_lead',
      trigger: 'appointment_created',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentCreated.title',
      hintKey: 'organization.settings.workflows.cards.appointmentCreated.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentCreated.vars',
    },
    {
      key: 'appointment_created_email_lead',
      trigger: 'appointment_created',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentCreated.title',
      hintKey: 'organization.settings.workflows.cards.appointmentCreated.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentCreated.vars',
    },
    {
      key: 'appointment_reminder_whatsapp_lead',
      trigger: 'appointment_reminder',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentReminder.title',
      hintKey: 'organization.settings.workflows.cards.appointmentReminder.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentReminder.vars',
    },
    {
      key: 'appointment_reminder_email_lead',
      trigger: 'appointment_reminder',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.appointmentReminder.title',
      hintKey: 'organization.settings.workflows.cards.appointmentReminder.hint',
      varsKey: 'organization.settings.workflows.cards.appointmentReminder.vars',
    },
    {
      key: 'partner_offer_created_whatsapp_partner',
      trigger: 'partner_offer_created',
      channel: 'whatsapp',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.partnerOfferCreated.title',
      hintKey: 'organization.settings.workflows.cards.partnerOfferCreated.hint',
      varsKey: 'organization.settings.workflows.cards.partnerOfferCreated.vars',
    },
    {
      key: 'partner_offer_created_email_partner',
      trigger: 'partner_offer_created',
      channel: 'email',
      audience: 'partner',
      titleKey: 'organization.settings.workflows.cards.partnerOfferCreated.title',
      hintKey: 'organization.settings.workflows.cards.partnerOfferCreated.hint',
      varsKey: 'organization.settings.workflows.cards.partnerOfferCreated.vars',
    },
    {
      key: 'job_completed_whatsapp_lead',
      trigger: 'job_completed',
      channel: 'whatsapp',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.jobCompleted.title',
      hintKey: 'organization.settings.workflows.cards.jobCompleted.hint',
      varsKey: 'organization.settings.workflows.cards.jobCompleted.vars',
    },
    {
      key: 'job_completed_email_lead',
      trigger: 'job_completed',
      channel: 'email',
      audience: 'lead',
      titleKey: 'organization.settings.workflows.cards.jobCompleted.title',
      hintKey: 'organization.settings.workflows.cards.jobCompleted.hint',
      varsKey: 'organization.settings.workflows.cards.jobCompleted.vars',
    },
  ];

  protected readonly actions: readonly WorkflowActionConfig[] = [
    {
      id: 'lead_welcome',
      titleKey: 'organization.settings.workflows.actions.leadWelcome',
      channels: {
        whatsapp: {
          cardKeys: ['lead_welcome_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.leadWelcome.hint',
          varsKey: 'organization.settings.workflows.cards.leadWelcome.vars',
        },
        email: {
          cardKeys: ['lead_welcome_email_lead'],
          hintKey: 'organization.settings.workflows.cards.leadWelcome.hint',
          varsKey: 'organization.settings.workflows.cards.leadWelcome.vars',
        },
      },
    },
    {
      id: 'quote_sent',
      titleKey: 'organization.settings.workflows.actions.quoteSent',
      channels: {
        whatsapp: {
          cardKeys: ['quote_sent_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteSent.hint',
          varsKey: 'organization.settings.workflows.cards.quoteSent.vars',
        },
        email: {
          cardKeys: ['quote_sent_email_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteSent.hint',
          varsKey: 'organization.settings.workflows.cards.quoteSent.vars',
        },
      },
    },
    {
      id: 'quote_question_asked',
      titleKey: 'organization.settings.workflows.actions.quoteQuestionAsked',
      channels: {
        whatsapp: {
          cardKeys: ['quote_question_asked_whatsapp_partner'],
          hintKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.hint',
          varsKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerWhatsApp.vars',
        },
        email: {
          cardKeys: ['quote_question_asked_email_partner'],
          hintKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerEmail.hint',
          varsKey: 'organization.settings.workflows.cards.quoteQuestionAskedPartnerEmail.vars',
        },
      },
    },
    {
      id: 'quote_question_answered',
      titleKey: 'organization.settings.workflows.actions.quoteQuestionAnswered',
      channels: {
        whatsapp: {
          cardKeys: ['quote_question_answered_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadWhatsApp.hint',
          varsKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadWhatsApp.vars',
        },
        email: {
          cardKeys: ['quote_question_answered_email_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadEmail.hint',
          varsKey: 'organization.settings.workflows.cards.quoteQuestionAnsweredLeadEmail.vars',
        },
      },
    },
    {
      id: 'quote_accepted',
      titleKey: 'organization.settings.workflows.actions.quoteAccepted',
      channels: {
        whatsapp: {
          cardKeys: ['quote_accepted_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteAcceptedLeadWhatsApp.hint',
          varsKey: 'organization.settings.workflows.cards.quoteAcceptedLeadWhatsApp.vars',
        },
        email: {
          cardKeys: ['quote_accepted_email_lead', 'quote_accepted_email_partner'],
          hintKey: 'organization.settings.workflows.cards.quoteAcceptedLeadEmail.hint',
          varsKey: 'organization.settings.workflows.cards.quoteAcceptedLeadEmail.vars',
        },
      },
    },
    {
      id: 'quote_rejected',
      titleKey: 'organization.settings.workflows.actions.quoteRejected',
      channels: {
        whatsapp: {
          cardKeys: ['quote_rejected_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteRejectedLeadWhatsApp.hint',
          varsKey: 'organization.settings.workflows.cards.quoteRejectedLeadWhatsApp.vars',
        },
        email: {
          cardKeys: ['quote_rejected_email_lead'],
          hintKey: 'organization.settings.workflows.cards.quoteRejectedLeadEmail.hint',
          varsKey: 'organization.settings.workflows.cards.quoteRejectedLeadEmail.vars',
        },
      },
    },
    {
      id: 'appointment_created',
      titleKey: 'organization.settings.workflows.actions.appointmentCreated',
      channels: {
        whatsapp: {
          cardKeys: ['appointment_created_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.appointmentCreated.hint',
          varsKey: 'organization.settings.workflows.cards.appointmentCreated.vars',
        },
        email: {
          cardKeys: ['appointment_created_email_lead'],
          hintKey: 'organization.settings.workflows.cards.appointmentCreated.hint',
          varsKey: 'organization.settings.workflows.cards.appointmentCreated.vars',
        },
      },
    },
    {
      id: 'appointment_reminder',
      titleKey: 'organization.settings.workflows.actions.appointmentReminder',
      channels: {
        whatsapp: {
          cardKeys: ['appointment_reminder_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.appointmentReminder.hint',
          varsKey: 'organization.settings.workflows.cards.appointmentReminder.vars',
        },
        email: {
          cardKeys: ['appointment_reminder_email_lead'],
          hintKey: 'organization.settings.workflows.cards.appointmentReminder.hint',
          varsKey: 'organization.settings.workflows.cards.appointmentReminder.vars',
        },
      },
    },
    {
      id: 'partner_offer_created',
      titleKey: 'organization.settings.workflows.actions.partnerOfferCreated',
      channels: {
        whatsapp: {
          cardKeys: ['partner_offer_created_whatsapp_partner'],
          hintKey: 'organization.settings.workflows.cards.partnerOfferCreated.hint',
          varsKey: 'organization.settings.workflows.cards.partnerOfferCreated.vars',
        },
        email: {
          cardKeys: ['partner_offer_created_email_partner'],
          hintKey: 'organization.settings.workflows.cards.partnerOfferCreated.hint',
          varsKey: 'organization.settings.workflows.cards.partnerOfferCreated.vars',
        },
      },
    },
    {
      id: 'job_completed',
      titleKey: 'organization.settings.workflows.actions.jobCompleted',
      channels: {
        whatsapp: {
          cardKeys: ['job_completed_whatsapp_lead'],
          hintKey: 'organization.settings.workflows.cards.jobCompleted.hint',
          varsKey: 'organization.settings.workflows.cards.jobCompleted.vars',
        },
        email: {
          cardKeys: ['job_completed_email_lead'],
          hintKey: 'organization.settings.workflows.cards.jobCompleted.hint',
          varsKey: 'organization.settings.workflows.cards.jobCompleted.vars',
        },
      },
    },
  ];

  private readonly cardConfigsByKey = new Map<WorkflowCardKey, WorkflowCardConfig>(
    this.cards.map(card => [card.key, card])
  );

  private readonly baseLeadVars: TemplateVariable[] = [
    { label: 'Naam', value: 'lead.name' },
    { label: 'Voornaam', value: 'lead.firstName' },
    { label: 'Achternaam', value: 'lead.lastName' },
    { label: 'Telefoon', value: 'lead.phone' },
    { label: 'Adres', value: 'lead.address' },
    { label: 'Straat', value: 'lead.street' },
    { label: 'Huisnummer', value: 'lead.houseNumber' },
    { label: 'Postcode', value: 'lead.zipCode' },
    { label: 'Plaats', value: 'lead.city' },
    { label: 'Diensttype', value: 'lead.serviceType' },
    { label: 'Bron', value: 'lead.source' },
    { label: 'Organisatie', value: 'org.name' },
  ];

  private readonly triggerVariables: Record<WorkflowTrigger, TemplateVariable[]> = {
    lead_welcome: [
      ...this.baseLeadVars,
      { label: 'Tracking link', value: 'links.track' },
    ],
    quote_sent: [
      ...this.baseLeadVars,
      { label: 'Offertenummer', value: 'quote.number' },
      { label: 'Offerte preview', value: 'quote.previewUrl' },
      { label: 'Offerte download', value: 'quote.downloadUrl' },
    ],
    quote_question_asked: [
      ...this.baseLeadVars,
      { label: 'Adviseur', value: 'partner.name' },
      { label: 'Adviseur telefoon', value: 'partner.phone' },
      { label: 'Adviseur e-mail', value: 'partner.email' },
      { label: 'Offertenummer', value: 'quote.number' },
      { label: 'Offerte preview', value: 'quote.previewUrl' },
      { label: 'Vraag of antwoord', value: 'annotation.text' },
      { label: 'Regelomschrijving', value: 'annotation.itemDescription' },
    ],
    quote_question_answered: [
      ...this.baseLeadVars,
      { label: 'Adviseur', value: 'partner.name' },
      { label: 'Adviseur telefoon', value: 'partner.phone' },
      { label: 'Adviseur e-mail', value: 'partner.email' },
      { label: 'Offertenummer', value: 'quote.number' },
      { label: 'Offerte preview', value: 'quote.previewUrl' },
      { label: 'Vraag of antwoord', value: 'annotation.text' },
      { label: 'Regelomschrijving', value: 'annotation.itemDescription' },
    ],
    quote_accepted: [
      ...this.baseLeadVars,
      { label: 'Offertenummer', value: 'quote.number' },
      { label: 'Offerte totaal', value: 'quote.total' },
      { label: 'Offerte download', value: 'quote.downloadUrl' },
      { label: 'Inplanlink', value: 'links.scheduling' },
    ],
    quote_rejected: [
      ...this.baseLeadVars,
    ],
    appointment_created: [
      ...this.baseLeadVars,
      { label: 'Datum', value: 'appointment.date' },
      { label: 'Tijd', value: 'appointment.time' },
      { label: 'Locatie', value: 'appointment.location' },
    ],
    appointment_reminder: [
      ...this.baseLeadVars,
      { label: 'Datum', value: 'appointment.date' },
      { label: 'Tijd', value: 'appointment.time' },
      { label: 'Locatie', value: 'appointment.location' },
    ],
    partner_offer_created: [
      { label: 'Partner naam', value: 'partner.name' },
      { label: 'Aanbod ID', value: 'offer.id' },
      { label: 'Accepteer link', value: 'links.accept' },
    ],
    job_completed: [
      ...this.baseLeadVars,
      { label: 'Review URL', value: 'org.reviewUrl' },
    ],
  };

  protected variablesForTrigger(trigger: WorkflowTrigger): TemplateVariable[] {
    return this.triggerVariables[trigger] ?? [];
  }

  protected readonly workflowOptions = computed<SelectOption<string>[]>(() =>
    this.workflowProfiles().map(profile => ({ value: profile.workflowKey, label: profile.name }))
  );

  protected readonly selectedProfile = computed<WorkflowProfileState | null>(() => {
    const key = this.selectedWorkflowKey();
    return this.workflowProfiles().find(profile => profile.workflowKey === key) ?? null;
  });

  protected readonly workflows = computed<Record<WorkflowCardKey, WorkflowFormState>>(() =>
    this.selectedProfile()?.cards ?? this.defaultState()
  );

  protected readonly selectedActionConfig = computed<WorkflowActionConfig>(() => {
    const selected = this.actions.find(action => action.id === this.selectedAction());
    return selected ?? this.actions.at(0)!;
  });

  protected readonly hasChanges = computed(() => this.initialSnapshot() !== JSON.stringify(this.serializeState()));
  protected readonly canSave = computed(() => !this.isSaving() && this.hasChanges());

  constructor() {
    this.load();
  }

  private defaultState(): Record<WorkflowCardKey, WorkflowFormState> {
    return {
      lead_welcome_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      lead_welcome_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_sent_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_sent_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_question_asked_whatsapp_partner: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_question_asked_email_partner: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_question_answered_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_question_answered_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_accepted_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_accepted_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_accepted_email_partner: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_rejected_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      quote_rejected_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      appointment_created_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      appointment_created_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      appointment_reminder_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      appointment_reminder_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      partner_offer_created_whatsapp_partner: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      partner_offer_created_email_partner: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      job_completed_whatsapp_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
      job_completed_email_lead: { enabled: true, delayMinutes: 0, templateSubject: '', templateText: '' },
    };
  }

  private load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      workflows: this.orgService.getWorkflowEngineWorkflows(),
      rules: this.orgService.getWorkflowAssignmentRules(),
    })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.workflows.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ workflows, rules }) => {
        this.applyWorkflowEngineData(workflows, rules);
      });
  }

  private applyWorkflowEngineData(workflows: WorkflowEngineWorkflow[], rules: WorkflowAssignmentRule[]): void {
    const mapped = workflows.map(workflow => this.mapWorkflowToProfile(workflow));
    if (mapped.length === 0) {
      mapped.push(this.createEmptyProfile('default'));
    }

    const selectedKey = this.selectedWorkflowKey();
    const stillExists = mapped.some(profile => profile.workflowKey === selectedKey);
    const first = mapped[0];

    this.workflowProfiles.set(mapped);
    this.assignmentRules.set(rules);
    this.selectedWorkflowKey.set(stillExists ? selectedKey : (first?.workflowKey ?? ''));

    const defaultRule = this.findDefaultRule(rules);
    const defaultProfile = defaultRule
      ? mapped.find(profile => profile.id === defaultRule.workflowId)
      : null;

    this.selectedDefaultWorkflowKey.set(defaultProfile?.workflowKey ?? (first?.workflowKey ?? ''));
    this.initialSnapshot.set(JSON.stringify(this.serializeState()));
  }

  private mapWorkflowToProfile(workflow: WorkflowEngineWorkflow): WorkflowProfileState {
    const cards = this.defaultState();

    const cardIndex = new Map<string, WorkflowCardKey>();
    for (const card of this.cards) {
      cardIndex.set(this.toRuleKey(card.trigger, card.channel, card.audience), card.key);
    }

    for (const step of workflow.steps) {
      const normalizedTrigger = this.normalizeTrigger(step.trigger);
      if (!normalizedTrigger) continue;

      const normalizedChannel = this.normalizeChannel(step.channel);
      const normalizedAudience = this.normalizeAudience(step.audience);
      if (!normalizedChannel || !normalizedAudience) continue;

      const key = cardIndex.get(this.toRuleKey(normalizedTrigger, normalizedChannel, normalizedAudience));
      if (!key) continue;

      cards[key] = {
        enabled: !!step.enabled,
        delayMinutes: this.normalizeDelay(step.delayMinutes),
        templateSubject: step.templateSubject ?? '',
        templateText: step.templateBody ?? '',
      };
    }

    return {
      id: workflow.id,
      workflowKey: workflow.workflowKey,
      name: workflow.name,
      enabled: workflow.enabled,
      cards,
    };
  }

  private createEmptyProfile(seed: string): WorkflowProfileState {
    return {
      workflowKey: seed,
      name: `Workflow ${seed}`,
      enabled: true,
      cards: this.defaultState(),
    };
  }

  protected addWorkflow(): void {
    const count = this.workflowProfiles().length + 1;
    const workflowKey = `workflow_${count}`;
    const profile: WorkflowProfileState = {
      workflowKey,
      name: `Workflow ${count}`,
      enabled: true,
      cards: this.defaultState(),
    };
    this.workflowProfiles.update(current => [...current, profile]);
    this.selectedWorkflowKey.set(workflowKey);
    if (!this.selectedDefaultWorkflowKey()) {
      this.selectedDefaultWorkflowKey.set(workflowKey);
    }
  }

  protected removeSelectedWorkflow(): void {
    const selectedKey = this.selectedWorkflowKey();
    const profiles = this.workflowProfiles();
    if (profiles.length <= 1) {
      return;
    }
    const next = profiles.filter(profile => profile.workflowKey !== selectedKey);
    const first = next[0];
    this.workflowProfiles.set(next);
    this.selectedWorkflowKey.set(first?.workflowKey ?? '');
    if (this.selectedDefaultWorkflowKey() === selectedKey) {
      this.selectedDefaultWorkflowKey.set(first?.workflowKey ?? '');
    }
  }

  protected updateSelectedWorkflow(value: string | null): void {
    this.selectedWorkflowKey.set(value ?? '');
  }

  protected updateSelectedAction(action: WorkflowTrigger): void {
    this.selectedAction.set(action);
  }

  protected updateSelectedDefaultWorkflow(value: string | null): void {
    this.selectedDefaultWorkflowKey.set(value ?? '');
  }

  protected updateSelectedWorkflowName(value: string): void {
    const key = this.selectedWorkflowKey();
    this.workflowProfiles.update(current => current.map(profile => (
      profile.workflowKey === key
        ? { ...profile, name: value.trim() || profile.name }
        : profile
    )));
  }

  protected updateSelectedWorkflowEnabled(enabled: boolean): void {
    const key = this.selectedWorkflowKey();
    this.workflowProfiles.update(current => current.map(profile => (
      profile.workflowKey === key
        ? { ...profile, enabled }
        : profile
    )));
  }

  private updateSelectedCard(update: (cards: Record<WorkflowCardKey, WorkflowFormState>) => Record<WorkflowCardKey, WorkflowFormState>): void {
    const key = this.selectedWorkflowKey();
    this.workflowProfiles.update(current => current.map(profile => (
      profile.workflowKey === key
        ? { ...profile, cards: update(profile.cards) }
        : profile
    )));
  }

  private updateSelectedCards(cardKeys: WorkflowCardKey[], update: (state: WorkflowFormState) => WorkflowFormState): void {
    if (cardKeys.length === 0) {
      return;
    }

    this.updateSelectedCard(current => {
      const next = { ...current };
      for (const key of cardKeys) {
        next[key] = update(next[key]);
      }
      return next;
    });
  }

  private selectedChannelConfig(channel: WorkflowChannel): WorkflowChannelConfig | null {
    return this.selectedActionConfig().channels[channel] ?? null;
  }

  private selectedChannelCardKeys(channel: WorkflowChannel): WorkflowCardKey[] {
    return this.selectedChannelConfig(channel)?.cardKeys ?? [];
  }

  private cardConfigByKey(key: WorkflowCardKey): WorkflowCardConfig | null {
    return this.cardConfigsByKey.get(key) ?? null;
  }

  protected isMultiCardChannel(channel: WorkflowChannel): boolean {
    return this.selectedChannelCardKeys(channel).length > 1;
  }

  protected selectedChannelCardStates(channel: WorkflowChannel): WorkflowSelectedChannelCardState[] {
    const workflowStates = this.workflows();

    return this.selectedChannelCardKeys(channel)
      .map(key => {
        const config = this.cardConfigByKey(key);
        const state = workflowStates[key];
        if (!config || !state) {
          return null;
        }

        const baseCard: WorkflowSelectedChannelCardState = {
          key,
          titleKey: config.titleKey,
          hintKey: config.hintKey,
          varsKey: config.varsKey,
          state,
        };

        if (config.noteKey) {
          return { ...baseCard, noteKey: config.noteKey };
        }

        return baseCard;
      })
      .filter((card): card is WorkflowSelectedChannelCardState => card !== null);
  }

  protected isChannelAvailable(channel: WorkflowChannel): boolean {
    return this.selectedChannelCardKeys(channel).length > 0;
  }

  protected channelHintKey(channel: WorkflowChannel): string {
    return this.selectedChannelConfig(channel)?.hintKey ?? '';
  }

  protected channelVarsKey(channel: WorkflowChannel): string {
    return this.selectedChannelConfig(channel)?.varsKey ?? '';
  }

  protected channelEnabled(channel: WorkflowChannel): boolean {
    const keys = this.selectedChannelCardKeys(channel);
    if (keys.length === 0) {
      return false;
    }
    return keys.every(key => this.workflows()[key].enabled);
  }

  protected channelDelay(channel: WorkflowChannel): number {
    const keys = this.selectedChannelCardKeys(channel);
    const firstKey = keys.at(0);
    if (!firstKey) {
      return 0;
    }
    return this.workflows()[firstKey].delayMinutes;
  }

  protected channelTemplate(channel: WorkflowChannel): string {
    const keys = this.selectedChannelCardKeys(channel);
    const firstKey = keys.at(0);
    if (!firstKey) {
      return '';
    }
    return this.workflows()[firstKey].templateText;
  }

  protected channelSubject(channel: WorkflowChannel): string {
    const keys = this.selectedChannelCardKeys(channel);
    const firstKey = keys.at(0);
    if (!firstKey) {
      return '';
    }
    return this.workflows()[firstKey].templateSubject;
  }

  protected updateEnabled(key: WorkflowCardKey, enabled: boolean): void {
    this.updateSelectedCard(current => ({
      ...current,
      [key]: { ...current[key], enabled },
    }));
  }

  protected updateDelay(key: WorkflowCardKey, delayMinutes: number | null): void {
    this.updateSelectedCard(current => ({
      ...current,
      [key]: { ...current[key], delayMinutes: this.normalizeDelay(delayMinutes ?? 0) },
    }));
  }

  protected updateTemplate(key: WorkflowCardKey, templateText: string): void {
    this.updateSelectedCard(current => ({
      ...current,
      [key]: { ...current[key], templateText },
    }));
  }

  protected updateSubject(key: WorkflowCardKey, templateSubject: string): void {
    this.updateSelectedCard(current => ({
      ...current,
      [key]: { ...current[key], templateSubject },
    }));
  }

  protected updateChannelEnabled(channel: WorkflowChannel, enabled: boolean): void {
    this.updateSelectedCards(this.selectedChannelCardKeys(channel), state => ({ ...state, enabled }));
  }

  protected updateChannelDelay(channel: WorkflowChannel, delayMinutes: number | null): void {
    const normalized = this.normalizeDelay(delayMinutes ?? 0);
    this.updateSelectedCards(this.selectedChannelCardKeys(channel), state => ({ ...state, delayMinutes: normalized }));
  }

  protected updateChannelTemplate(channel: WorkflowChannel, templateText: string): void {
    this.updateSelectedCards(this.selectedChannelCardKeys(channel), state => ({ ...state, templateText }));
  }

  protected updateChannelSubject(channel: WorkflowChannel, templateSubject: string): void {
    this.updateSelectedCards(this.selectedChannelCardKeys(channel), state => ({ ...state, templateSubject }));
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const workflowPayload = this.workflowProfiles().map(profile => this.mapProfileToUpsert(profile));

    this.orgService
      .replaceWorkflowEngineWorkflows({ workflows: workflowPayload })
      .pipe(
        switchMap(savedWorkflows => {
          const defaultKey = this.selectedDefaultWorkflowKey();
          const defaultWorkflow = savedWorkflows.find(workflow => workflow.workflowKey === defaultKey) ?? savedWorkflows[0];
          if (!defaultWorkflow) {
            return EMPTY;
          }

          const existingRules = this.assignmentRules();
          const previousDefault = this.findDefaultRule(existingRules);
          const preservedRules = existingRules.filter(rule => !this.isDefaultRule(rule));

          const defaultRule: UpsertWorkflowAssignmentRuleRequest = {
            ...(previousDefault?.id ? { id: previousDefault.id } : {}),
            workflowId: defaultWorkflow.id,
            name: 'Default workflow',
            enabled: true,
            priority: 1_000_000,
            leadSource: null,
            leadServiceType: null,
            pipelineStage: null,
          };

          return this.orgService.replaceWorkflowAssignmentRules({ rules: [...preservedRules, defaultRule] }).pipe(
            switchMap(() => forkJoin({
              workflows: this.orgService.getWorkflowEngineWorkflows(),
              rules: this.orgService.getWorkflowAssignmentRules(),
            }))
          );
        }),
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.workflows.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ workflows, rules }) => {
        this.applyWorkflowEngineData(workflows, rules);
        this.successMessage.set(this.translate.instant('organization.settings.workflows.saved'));
      });
  }

  private serializeState(): {
    workflows: WorkflowProfileState[];
    selectedWorkflowKey: string;
    selectedDefaultWorkflowKey: string;
  } {
    return {
      workflows: this.workflowProfiles(),
      selectedWorkflowKey: this.selectedWorkflowKey(),
      selectedDefaultWorkflowKey: this.selectedDefaultWorkflowKey(),
    };
  }

  private mapProfileToUpsert(profile: WorkflowProfileState): UpsertWorkflowRequest {
    const steps: UpsertWorkflowStepRequest[] = this.cards.map((card, index) => {
      const state = profile.cards[card.key];
      const trimmedTemplateSubject = state.templateSubject.trim();
      let templateSubject: string | null = null;
      if (card.channel === 'email' && trimmedTemplateSubject !== '') {
        templateSubject = trimmedTemplateSubject;
      }

      return {
        trigger: card.trigger,
        channel: card.channel,
        audience: card.audience,
        action: 'send_message',
        stepOrder: index + 1,
        delayMinutes: this.normalizeDelay(state.delayMinutes),
        enabled: state.enabled,
        recipientConfig: this.defaultRecipientConfig(card.audience),
        templateSubject,
        templateBody: state.templateText.trim() ? state.templateText.trim() : null,
        stopOnReply: false,
      };
    });

    return {
      ...(profile.id ? { id: profile.id } : {}),
      workflowKey: profile.workflowKey,
      name: profile.name.trim() || profile.workflowKey,
      enabled: profile.enabled,
      steps,
    };
  }

  private defaultRecipientConfig(audience: WorkflowAudience): WorkflowStep['recipientConfig'] {
    return {
      audience,
      includeAssignedAgent: false,
      includeLeadContact: audience === 'lead',
      includePartner: audience === 'partner',
      includeInternal: false,
    };
  }

  private findDefaultRule(rules: WorkflowAssignmentRule[]): WorkflowAssignmentRule | null {
    return rules.find(rule => this.isDefaultRule(rule)) ?? null;
  }

  private isDefaultRule(rule: WorkflowAssignmentRule): boolean {
    return !rule.leadSource && !rule.leadServiceType && !rule.pipelineStage;
  }

  private toRuleKey(trigger: WorkflowTrigger, channel: WorkflowChannel, audience: WorkflowAudience): string {
    return `${trigger}|${channel}|${audience}`;
  }

  private normalizeTrigger(trigger: string): WorkflowTrigger | null {
    const value = trigger.trim().toLowerCase();
    switch (value) {
      case 'lead_welcome':
      case 'quote_sent':
      case 'quote_question_asked':
      case 'quote_question_answered':
      case 'quote_accepted':
      case 'quote_rejected':
      case 'appointment_created':
      case 'appointment_reminder':
      case 'partner_offer_created':
        return value;
      default:
        return null;
    }
  }

  private normalizeChannel(channel: string): WorkflowChannel | null {
    const value = channel.trim().toLowerCase();
    if (value === 'whatsapp' || value === 'email') {
      return value;
    }
    return null;
  }

  private normalizeAudience(audience: string): WorkflowAudience | null {
    const value = audience.trim().toLowerCase();
    if (value === 'lead' || value === 'partner') {
      return value;
    }
    return null;
  }

  private normalizeDelay(delayMinutes: number): number {
    if (!Number.isFinite(delayMinutes)) return 0;
    return Math.max(0, Math.min(1440, Math.round(delayMinutes)));
  }
}
