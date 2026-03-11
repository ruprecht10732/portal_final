import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_GLOBAL_ERROR_REPORTING } from '../interceptors/error-reporting-context';
import { toHttpParams } from '../utils/http-utils';

export interface Organization {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  kvkNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  logoFileKey?: string;
  logoFileName?: string;
  logoContentType?: string;
  logoSizeBytes?: number;
}

export interface UpdateOrganizationRequest {
  name?: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  kvkNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface OrgLogoPresignRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface OrgLogoPresignResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: number;
}

export interface SetOrgLogoRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface OrgLogoDownloadResponse {
  downloadUrl: string;
  expiresAt: number;
}

export interface OrganizationSettings {
  quotePaymentDays: number;
  quoteValidDays: number;
  aiAutoDisqualifyJunk: boolean;
  aiAutoDispatch: boolean;
  aiAutoEstimate: boolean;
  aiConfidenceGateEnabled: boolean;
  aiAdaptiveReasoningEnabled: boolean;
  aiExperienceMemoryEnabled: boolean;
  aiCouncilEnabled: boolean;
  aiCouncilConsensusMode: 'weighted' | 'majority' | 'estimator_final';
  catalogGapThreshold: number;
  catalogGapLookbackDays: number;
  photoAnalysisPreprocessingEnabled: boolean;
  photoAnalysisOcrAssistEnabled: boolean;
  photoAnalysisOcrAssistServiceTypes: string[];
  photoAnalysisLensCorrectionEnabled: boolean;
  photoAnalysisLensCorrectionServiceTypes: string[];
  photoAnalysisPerspectiveNormalizationEnabled: boolean;
  photoAnalysisPerspectiveNormalizationServiceTypes: string[];
  notificationEmail?: string | null;
  whatsAppDeviceId?: string | null;
  whatsAppAccountJid?: string | null;
  whatsAppToneOfVoice: string;
  whatsAppDefaultReplyScenario: string;
  emailDefaultReplyScenario: string;
  quoteRelatedReplyScenario: string;
  appointmentRelatedReplyScenario: string;
  whatsAppPresence?: 'available' | 'unavailable';
}

export interface ReplyScenarioAnalyticsItem {
  scenario: string;
  sentCount: number;
  editedCount: number;
  editRate: number;
  lastUsedAt?: string | null;
}

export interface ReplyScenarioAnalyticsResponse {
  items: ReplyScenarioAnalyticsItem[];
}

export interface UpdateOrganizationSettingsRequest {
  quotePaymentDays?: number;
  quoteValidDays?: number;
  notificationEmail?: string;

  aiAutoDisqualifyJunk?: boolean;
  aiAutoDispatch?: boolean;
  aiAutoEstimate?: boolean;
  aiConfidenceGateEnabled?: boolean;
  aiAdaptiveReasoningEnabled?: boolean;
  aiExperienceMemoryEnabled?: boolean;
  aiCouncilEnabled?: boolean;
  aiCouncilConsensusMode?: 'weighted' | 'majority' | 'estimator_final';
  catalogGapThreshold?: number;
  catalogGapLookbackDays?: number;
  photoAnalysisPreprocessingEnabled?: boolean;
  photoAnalysisOcrAssistEnabled?: boolean;
  photoAnalysisOcrAssistServiceTypes?: string[];
  photoAnalysisLensCorrectionEnabled?: boolean;
  photoAnalysisLensCorrectionServiceTypes?: string[];
  photoAnalysisPerspectiveNormalizationEnabled?: boolean;
  photoAnalysisPerspectiveNormalizationServiceTypes?: string[];
  whatsAppToneOfVoice?: string;
  whatsAppDefaultReplyScenario?: string;
  emailDefaultReplyScenario?: string;
  quoteRelatedReplyScenario?: string;
  appointmentRelatedReplyScenario?: string;
  whatsAppPresence?: 'available' | 'unavailable';
}

export interface WhatsAppStatus {
  state: string;
  message: string;
  canSend: boolean;
  needsReauth: boolean;
  presence: 'available' | 'unavailable';
  deviceId?: string;
  accountJid?: string;
}

export interface RegisterWhatsAppResponse {
  deviceId: string;
  status: string;
}

export interface DisconnectWhatsAppResponse {
  status: string;
}

export interface ReconnectWhatsAppResponse {
  message: string;
}

export interface WhatsAppTestResponse {
  status: string;
  phoneNumber: string;
}

export interface SetSMTPRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface SMTPStatusResponse {
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface TestSMTPRequest {
  toEmail: string;
}

export interface SMTPActionResponse {
  status: string;
}

export interface DetectSMTPResponse {
  detected: boolean;
  provider?: string;
  host?: string;
  port?: number;
  username?: string;
  security?: string;
}

export interface InviteRequest {
  email: string;
}

export interface InviteResponse {
  token: string;
  expiresAt: string;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string | null;
}

export interface ListInvitesResponse {
  invites: OrganizationInvite[];
}

export interface UpdateInviteRequest {
  email?: string;
  resend?: boolean;
}

export interface UpdateInviteResponse {
  invite: OrganizationInvite;
  token?: string | null;
}

export interface WorkflowStepRecipientConfig {
  audience?: string;
  includeAssignedAgent: boolean;
  includeLeadContact: boolean;
  includePartner: boolean;
  includeInternal: boolean;
  customEmails?: string[];
  customPhones?: string[];
}

export interface WorkflowStep {
  id?: string;
  trigger: string;
  channel: 'whatsapp' | 'email';
  audience: 'lead' | 'partner' | 'agent' | 'internal' | 'custom';
  action: 'send_message' | 'send_template';
  stepOrder: number;
  delayMinutes: number;
  enabled: boolean;
  recipientConfig: WorkflowStepRecipientConfig;
  templateSubject?: string | null;
  templateBody?: string | null;
  stopOnReply: boolean;
}

export interface WorkflowEngineWorkflow {
  id: string;
  workflowKey: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  quoteValidDaysOverride?: number | null;
  quotePaymentDaysOverride?: number | null;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWorkflowStepRequest {
  id?: string;
  trigger: string;
  channel: 'whatsapp' | 'email';
  audience: 'lead' | 'partner' | 'agent' | 'internal' | 'custom';
  action: 'send_message' | 'send_template';
  stepOrder: number;
  delayMinutes: number;
  enabled: boolean;
  recipientConfig: WorkflowStepRecipientConfig;
  templateSubject?: string | null;
  templateBody?: string | null;
  stopOnReply: boolean;
}

export interface UpsertWorkflowRequest {
  id?: string;
  workflowKey: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  quoteValidDaysOverride?: number | null;
  quotePaymentDaysOverride?: number | null;
  steps: UpsertWorkflowStepRequest[];
}

export interface ReplaceWorkflowEngineWorkflowsRequest {
  workflows: UpsertWorkflowRequest[];
}

export interface ListWorkflowEngineWorkflowsResponse {
  workflows: WorkflowEngineWorkflow[];
}

export interface WorkflowAssignmentRule {
  id: string;
  workflowId: string;
  name: string;
  enabled: boolean;
  priority: number;
  leadSource?: string | null;
  leadServiceType?: string | null;
  pipelineStage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWorkflowAssignmentRuleRequest {
  id?: string;
  workflowId: string;
  name: string;
  enabled: boolean;
  priority: number;
  leadSource?: string | null;
  leadServiceType?: string | null;
  pipelineStage?: string | null;
}

export interface ReplaceWorkflowAssignmentRulesRequest {
  rules: UpsertWorkflowAssignmentRuleRequest[];
}

export interface ListWorkflowAssignmentRulesResponse {
  rules: WorkflowAssignmentRule[];
}

export interface LeadWorkflowOverride {
  leadId: string;
  workflowId?: string | null;
  overrideMode: 'manual' | 'manual_lock' | 'clear';
  reason?: string | null;
  assignedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertLeadWorkflowOverrideRequest {
  leadId: string;
  workflowId?: string | null;
  overrideMode: 'manual' | 'manual_lock' | 'clear';
  reason?: string | null;
}

export interface ResolveLeadWorkflowResponse {
  workflow?: WorkflowEngineWorkflow | null;
  resolutionSource: 'manual_override' | 'auto_rule' | 'organization_default';
  overrideMode?: 'manual' | 'manual_lock' | 'clear' | null;
  matchedRuleId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/organizations`;

  getOrganization(): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/me`);
  }

  updateOrganization(payload: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.patch<Organization>(`${this.baseUrl}/me`, payload);
  }

  createInvite(payload: InviteRequest): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(`${this.baseUrl}/invites`, payload);
  }

  listInvites(): Observable<OrganizationInvite[]> {
    return this.http.get<ListInvitesResponse>(`${this.baseUrl}/invites`).pipe(
      map(response => response.invites)
    );
  }

  updateInvite(inviteId: string, payload: UpdateInviteRequest): Observable<UpdateInviteResponse> {
    return this.http.patch<UpdateInviteResponse>(`${this.baseUrl}/invites/${inviteId}`, payload);
  }

  revokeInvite(inviteId: string): Observable<OrganizationInvite> {
    return this.http.delete<OrganizationInvite>(`${this.baseUrl}/invites/${inviteId}`);
  }

  presignLogo(request: OrgLogoPresignRequest): Observable<OrgLogoPresignResponse> {
    return this.http.post<OrgLogoPresignResponse>(`${this.baseUrl}/me/logo/presign`, request);
  }

  setLogo(request: SetOrgLogoRequest): Observable<Organization> {
    return this.http.post<Organization>(`${this.baseUrl}/me/logo`, request);
  }

  getLogoDownloadUrl(): Observable<OrgLogoDownloadResponse> {
    return this.http.get<OrgLogoDownloadResponse>(`${this.baseUrl}/me/logo/download`);
  }

  deleteLogo(): Observable<Organization> {
    return this.http.delete<Organization>(`${this.baseUrl}/me/logo`);
  }

  getSettings(): Observable<OrganizationSettings> {
    return this.http.get<OrganizationSettings>(`${this.baseUrl}/me/settings`);
  }

  updateSettings(payload: UpdateOrganizationSettingsRequest): Observable<OrganizationSettings> {
    return this.http.patch<OrganizationSettings>(`${this.baseUrl}/me/settings`, payload);
  }

  getWhatsAppReplyScenarioAnalytics(): Observable<ReplyScenarioAnalyticsItem[]> {
    return this.http.get<ReplyScenarioAnalyticsResponse>(`${this.baseUrl}/me/whatsapp/reply-scenario-analytics`).pipe(
      map(response => response.items)
    );
  }

  getWorkflowEngineWorkflows(): Observable<WorkflowEngineWorkflow[]> {
    return this.http.get<ListWorkflowEngineWorkflowsResponse>(`${this.baseUrl}/me/workflow-engine/workflows`).pipe(
      map(response => response.workflows)
    );
  }

  replaceWorkflowEngineWorkflows(payload: ReplaceWorkflowEngineWorkflowsRequest): Observable<WorkflowEngineWorkflow[]> {
    return this.http.put<ListWorkflowEngineWorkflowsResponse>(`${this.baseUrl}/me/workflow-engine/workflows`, payload).pipe(
      map(response => response.workflows)
    );
  }

  getWorkflowAssignmentRules(): Observable<WorkflowAssignmentRule[]> {
    return this.http.get<ListWorkflowAssignmentRulesResponse>(`${this.baseUrl}/me/workflow-engine/assignment-rules`).pipe(
      map(response => response.rules)
    );
  }

  replaceWorkflowAssignmentRules(payload: ReplaceWorkflowAssignmentRulesRequest): Observable<WorkflowAssignmentRule[]> {
    return this.http.put<ListWorkflowAssignmentRulesResponse>(`${this.baseUrl}/me/workflow-engine/assignment-rules`, payload).pipe(
      map(response => response.rules)
    );
  }

  getLeadWorkflowOverride(leadId: string): Observable<LeadWorkflowOverride | null> {
    return this.http.get<LeadWorkflowOverride | null>(`${this.baseUrl}/me/workflow-engine/leads/${leadId}/override`);
  }

  upsertLeadWorkflowOverride(leadId: string, payload: UpsertLeadWorkflowOverrideRequest): Observable<LeadWorkflowOverride> {
    return this.http.put<LeadWorkflowOverride>(`${this.baseUrl}/me/workflow-engine/leads/${leadId}/override`, payload);
  }

  deleteLeadWorkflowOverride(leadId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.baseUrl}/me/workflow-engine/leads/${leadId}/override`);
  }

  resolveLeadWorkflow(leadId: string, params?: {
    leadSource?: string | null;
    leadServiceType?: string | null;
    pipelineStage?: string | null;
  }): Observable<ResolveLeadWorkflowResponse> {
    const query = toHttpParams({
      leadSource: params?.leadSource ?? undefined,
      leadServiceType: params?.leadServiceType ?? undefined,
      pipelineStage: params?.pipelineStage ?? undefined,
    });
    return this.http.get<ResolveLeadWorkflowResponse>(`${this.baseUrl}/me/workflow-engine/leads/${leadId}/resolve`, { params: query });
  }

  registerWhatsAppDevice(): Observable<RegisterWhatsAppResponse> {
    return this.http.post<RegisterWhatsAppResponse>(`${this.baseUrl}/me/whatsapp/register`, {});
  }

  getWhatsAppStatus(): Observable<WhatsAppStatus> {
    return this.http.get<WhatsAppStatus>(`${this.baseUrl}/me/whatsapp/status`);
  }

  reconnectWhatsApp(): Observable<ReconnectWhatsAppResponse> {
    return this.http.post<ReconnectWhatsAppResponse>(`${this.baseUrl}/me/whatsapp/reconnect`, {});
  }

  testWhatsApp(): Observable<WhatsAppTestResponse> {
    return this.http.post<WhatsAppTestResponse>(`${this.baseUrl}/me/whatsapp/test`, {});
  }

  disconnectWhatsApp(): Observable<DisconnectWhatsAppResponse> {
    return this.http.delete<DisconnectWhatsAppResponse>(`${this.baseUrl}/me/whatsapp`);
  }

  getWhatsAppQr(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/me/whatsapp/qr`, {
      context: new HttpContext().set(SKIP_GLOBAL_ERROR_REPORTING, true),
      responseType: 'blob',
    });
  }

  getSMTPStatus(): Observable<SMTPStatusResponse> {
    return this.http.get<SMTPStatusResponse>(`${this.baseUrl}/me/smtp/status`);
  }

  setSMTP(payload: SetSMTPRequest): Observable<SMTPActionResponse> {
    return this.http.put<SMTPActionResponse>(`${this.baseUrl}/me/smtp`, payload);
  }

  clearSMTP(): Observable<SMTPActionResponse> {
    return this.http.delete<SMTPActionResponse>(`${this.baseUrl}/me/smtp`);
  }

  testSMTP(payload: TestSMTPRequest): Observable<SMTPActionResponse> {
    return this.http.post<SMTPActionResponse>(`${this.baseUrl}/me/smtp/test`, payload);
  }

  detectSMTP(email: string): Observable<DetectSMTPResponse> {
    return this.http.post<DetectSMTPResponse>(`${this.baseUrl}/me/smtp/detect`, { email });
  }
}
