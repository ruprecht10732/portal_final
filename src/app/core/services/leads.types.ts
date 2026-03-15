// Lead types matching backend DTOs

export type ConsumerRole = 'Owner' | 'Tenant' | 'Landlord';
export type LeadStatus =
  | 'New'
  | 'Pending'
  | 'In_Progress'
  | 'Attempted_Contact'
  | 'Appointment_Scheduled'
  | 'Needs_Rescheduling'
  | 'Completed'
  | 'Disqualified';
export type PipelineStage =
  | 'Triage'
  | 'Nurturing'
  | 'Estimation'
  | 'Proposal'
  | 'Fulfillment'
  | 'Manual_Intervention'
  | 'Completed'
  | 'Lost';
export type LeadNoteType = 'note' | 'call' | 'text' | 'email' | 'system';

export interface Consumer {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: ConsumerRole;
}

export interface Address {
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string;
  authorEmail: string;
  type: LeadNoteType;
  body: string;
  createdAt: string;
  updatedAt: string;
  consumerNote?: string;
  source?: string;
}

export interface LeadService {
  id: string;
  serviceType: string;
  status: LeadStatus;
  pipelineStage: PipelineStage;
  preferences?: LeadPreferences | null;
  consumerNote?: string;
  source?: string | null;
  extraWorkAmountCents?: number | null;
  extraWorkNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadPreferences {
  budget?: string | null;
  timeframe?: string | null;
  availability?: string | null;
  extraNotes?: string | null;
}

export interface EnergyLabel {
  energieklasse: string;
  energieIndex?: number | null;
  bouwjaar?: number | null;
  geldigTot?: string | null;
  gebouwtype?: string | null;
  registratiedatum?: string | null;
  primaireFossieleEnergie?: number | null;
}

export interface LeadEnrichment {
  source?: string | null;
  postcode6?: string | null;
  buurtcode?: string | null;
  woningtypeCode?: string | null;
  bouwjaarklasseCode?: number | null;
  woningeigendomCode?: number | null;
  inkomenCode?: number | null;
  gemAardgasverbruik?: number | null;
  huishoudenGrootte?: number | null;
  koopwoningenPct?: number | null;
  bouwjaarVanaf2000Pct?: number | null;
  mediaanVermogenX1000?: number | null;
  huishoudensMetKinderenPct?: number | null;
  confidence?: number | null;
  fetchedAt?: string | null;
}

export interface LeadScore {
  score?: number | null;
  preAi?: number | null;
  factors?: Record<string, number> | null;
  version?: string | null;
  updatedAt?: string | null;
}

export interface Lead {
  id: string;
  consumer: Consumer;
  address: Address;
  source?: string;
  services: LeadService[];
  currentService?: LeadService;
  aggregateStatus?: LeadStatus;
  assignedAgentId?: string | null;
  viewedById?: string;
  viewedAt?: string;
  energyLabel?: EnergyLabel | null;
  leadEnrichment?: LeadEnrichment | null;
  leadScore?: LeadScore | null;
  whatsappOptedIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadTimelineItem {
  id: string;
  serviceId?: string;
  type: 'ai' | 'user' | 'stage' | 'system';
  title: string;
  summary: string;
  timestamp: string;
  actor: string;
  metadata: LeadTimelineMetadata;
  visibility?: 'public' | 'internal' | 'debug';
}

export type WhatsAppMessageStatus = 'sent' | 'draft' | 'failed';

export interface WhatsAppTimelineDrafts {
  whatsappMessage?: string;
  status?: WhatsAppMessageStatus;
  messageLanguage?: string;
  messageAudience?: string;
  messageCategory?: string;
  emailSubject?: string;
  emailBody?: string;
}

export interface WhatsAppTimelineMetadata {
  status?: WhatsAppMessageStatus;
  messageCategory?: string;
  messageAudience?: string;
  messageLanguage?: string;
  phoneNumber?: string;
  messageContent?: string;
  sentAt?: string;
  sourceTimelineEventId?: string;
  sourceTimelineEventTitle?: string;
  drafts?: WhatsAppTimelineDrafts;
  whatsappUrl?: string;
  preferredContactChannel?: 'WhatsApp' | 'Email';
  suggestedContactMessage?: string;
}

export type LeadTimelineMetadata = Record<string, unknown> & WhatsAppTimelineMetadata;

export interface LeadTimelineResponse {
  items: LeadTimelineItem[];
}

export interface TimelineWhatsAppSendResponse {
  status: string;
  eventId: string;
}

export interface LeadLinkedWhatsAppConversation {
  conversationId: string;
  phoneNumber: string;
  displayName: string;
  lastMessagePreview: string;
  lastMessageAt?: string | null;
  lastMessageDirection: string;
  lastMessageStatus: string;
  relationshipUpdatedAt: string;
}

export interface LeadLinkedEmailMessage {
  accountId: string;
  messageUid: number;
  subject: string;
  fromName?: string | null;
  fromAddress?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  relationshipUpdatedAt: string;
}

export interface LeadInboxCommunicationsResponse {
  whatsAppConversations: LeadLinkedWhatsAppConversation[];
  emailMessages: LeadLinkedEmailMessage[];
}

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  consumerRole: ConsumerRole;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  latitude?: number;
  longitude?: number;
  serviceType: string;
  assigneeId?: string | null;
  consumerNote?: string;
  source?: string;
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  adLandingPage?: string;
  referrerUrl?: string;
  workflowId?: string;
  whatsappOptedIn?: boolean;
}

export interface UpdateLeadRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  consumerRole?: ConsumerRole;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  assigneeId?: string | null;
  whatsappOptedIn?: boolean;
}

export interface AddServiceRequest {
  serviceType: string;
  closeCurrentStatus?: boolean;
  consumerNote?: string;
  source?: string;
}

export interface UpdateServiceStatusRequest {
  status: LeadStatus;
}

export interface UpdateServiceTypeRequest {
  serviceType: string;
}

export interface CompleteServiceRequest {
  extraWorkAmountCents: number | null;
  extraWorkNotes: string | null;
}

export interface UpdateStatusRequest {
  status: LeadStatus;
}

export interface CreateLeadNoteRequest {
  body: string;
  type?: LeadNoteType;
}

export interface LeadNotesResponse {
  items: LeadNote[];
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingLead?: Lead;
}

// Returning customer detection
export interface ServiceBrief {
  serviceType: string;
  status: LeadStatus;
  createdAt: string;
}

export interface ReturningCustomerResponse {
  found: boolean;
  leadId?: string;
  fullName?: string;
  totalServices: number;
  services?: ServiceBrief[];
}

export interface BulkDeleteLeadsResponse {
  deletedCount: number;
}

export interface ListLeadsParams {
  status?: LeadStatus;
  serviceType?: string;
  search?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  role?: ConsumerRole;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  assignedAgentId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
}

export type SortField =
  | 'createdAt'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'role'
  | 'street'
  | 'houseNumber'
  | 'zipCode'
  | 'city'
  | 'assignedAgentId';

// Status display helpers
export const STATUS_LABELS: Record<LeadStatus, string> = {
  New: 'New',
  Pending: 'Pending',
  In_Progress: 'In Progress',
  Attempted_Contact: 'Attempted Contact',
  Appointment_Scheduled: 'Appointment Scheduled',
  Needs_Rescheduling: 'Needs Rescheduling',
  Completed: 'Completed',
  Disqualified: 'Disqualified',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  New: 'bg-blue-100 text-blue-800',
  Pending: 'bg-sky-100 text-sky-800',
  In_Progress: 'bg-indigo-100 text-indigo-800',
  Attempted_Contact: 'bg-yellow-100 text-yellow-800',
  Appointment_Scheduled: 'bg-purple-100 text-purple-800',
  Needs_Rescheduling: 'bg-orange-100 text-orange-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Disqualified: 'bg-rose-100 text-rose-800',
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  Triage: 'Triage',
  Nurturing: 'Nurturing',
  Estimation: 'Estimation',
  Proposal: 'Proposal',
  Fulfillment: 'Fulfillment',
  Manual_Intervention: 'Manual Intervention',
  Completed: 'Completed',
  Lost: 'Lost',
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  Triage: 'bg-blue-100 text-blue-800',
  Nurturing: 'bg-amber-100 text-amber-800',
  Estimation: 'bg-indigo-100 text-indigo-800',
  Proposal: 'bg-teal-100 text-teal-800',
  Fulfillment: 'bg-purple-100 text-purple-800',
  Manual_Intervention: 'bg-red-100 text-red-800',
  Completed: 'bg-zinc-200 text-zinc-700',
  Lost: 'bg-zinc-200 text-zinc-600',
};

export const LEAD_STATUS_I18N_KEYS: Record<LeadStatus, string> = {
  New: 'leads.detail.status.new',
  Pending: 'leads.detail.status.pending',
  In_Progress: 'leads.detail.status.inProgress',
  Attempted_Contact: 'leads.detail.status.attemptedContact',
  Appointment_Scheduled: 'leads.detail.status.appointmentScheduled',
  Needs_Rescheduling: 'leads.detail.status.needsRescheduling',
  Completed: 'leads.detail.status.completed',
  Disqualified: 'leads.detail.status.disqualified',
};

export const buildLeadStatusLabels = (translate: (key: string) => string): Record<LeadStatus, string> => {
  const labels = {} as Record<LeadStatus, string>;
  (Object.keys(LEAD_STATUS_I18N_KEYS) as LeadStatus[]).forEach((status) => {
    const key = LEAD_STATUS_I18N_KEYS[status];
    const translated = translate(key);
    labels[status] = translated || STATUS_LABELS[status];
  });
  return labels;
};

export const PIPELINE_STAGE_I18N_KEYS: Record<PipelineStage, string> = {
  Triage: 'leads.pipeline.triage',
  Nurturing: 'leads.pipeline.nurturing',
  Estimation: 'leads.pipeline.estimation',
  Proposal: 'leads.pipeline.proposal',
  Fulfillment: 'leads.pipeline.fulfillment',
  Manual_Intervention: 'leads.pipeline.manualIntervention',
  Completed: 'leads.pipeline.completed',
  Lost: 'leads.pipeline.lost',
};

export const buildPipelineStageLabels = (translate: (key: string) => string): Record<PipelineStage, string> => {
  const labels = {} as Record<PipelineStage, string>;
  (Object.keys(PIPELINE_STAGE_I18N_KEYS) as PipelineStage[]).forEach((stage) => {
    const key = PIPELINE_STAGE_I18N_KEYS[stage];
    const translated = translate(key);
    labels[stage] = translated || PIPELINE_STAGE_LABELS[stage];
  });
  return labels;
};

export const CONSUMER_ROLE_OPTIONS: { label: string; value: ConsumerRole }[] = [
  { label: 'Owner', value: 'Owner' },
  { label: 'Tenant', value: 'Tenant' },
  { label: 'Landlord', value: 'Landlord' },
];

export const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'New' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In_Progress' },
  { label: 'Attempted Contact', value: 'Attempted_Contact' },
  { label: 'Appointment Scheduled', value: 'Appointment_Scheduled' },
  { label: 'Needs Rescheduling', value: 'Needs_Rescheduling' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Disqualified', value: 'Disqualified' },
];

export const MANUAL_STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'New' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In_Progress' },
  { label: 'Attempted Contact', value: 'Attempted_Contact' },
  { label: 'Appointment Scheduled', value: 'Appointment_Scheduled' },
  { label: 'Needs Rescheduling', value: 'Needs_Rescheduling' },
  { label: 'Disqualified', value: 'Disqualified' },
];

export const ALLOWED_STATUS_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  New: ['Attempted_Contact', 'Pending', 'Appointment_Scheduled', 'Needs_Rescheduling', 'In_Progress', 'Disqualified'],
  Attempted_Contact: ['Pending', 'Appointment_Scheduled', 'Needs_Rescheduling', 'Disqualified'],
  Pending: ['Attempted_Contact', 'Appointment_Scheduled', 'In_Progress', 'Disqualified'],
  Appointment_Scheduled: ['Needs_Rescheduling', 'Pending', 'In_Progress', 'Disqualified'],
  Needs_Rescheduling: ['Appointment_Scheduled', 'Attempted_Contact', 'Pending', 'Disqualified'],
  In_Progress: ['Pending', 'Disqualified'],
  Completed: [],
  Disqualified: [],
};

// AI Analysis types
export type UrgencyLevel = 'High' | 'Medium' | 'Low';
export type LeadQuality = 'Junk' | 'Low' | 'Potential' | 'High' | 'Urgent';
export type RecommendedAction = 'Reject' | 'RequestInfo' | 'ScheduleSurvey' | 'CallImmediately';
export type PreferredContactChannel = 'WhatsApp' | 'Email';

export interface LeadAIAnalysis {
  id: string;
  leadId: string;
  organizationId: string;
  leadServiceId: string;
  urgencyLevel: UrgencyLevel;
  urgencyReason?: string | null;
  leadQuality: LeadQuality;
  recommendedAction: RecommendedAction;
  missingInformation: string[];
  resolvedInformation: string[];
  extractedFacts: Record<string, string>;
  preferredContactChannel: PreferredContactChannel;
  suggestedContactMessage: string;
  summary: string;
  createdAt: string;
}

export interface LeadAIAnalysisListResponse {
  items: LeadAIAnalysis[];
}

export interface LeadAIAnalysisResponse {
  analysis: LeadAIAnalysis;
  isDefault: boolean;
}

export interface AnalyzeLeadResponse {
  status?: 'created' | 'queued' | 'no_change' | 'error';
  message: string;
  analysis?: LeadAIAnalysis;
  leadId?: string;
}

// Photo Analysis types
export type PhotoAnalysisConfidence = 'High' | 'Medium' | 'Low';
export type PhotoMeasurementType = 'dimension' | 'area' | 'count' | 'volume';

export interface PhotoMeasurement {
  description: string;
  value: number;
  unit: string;
  type: PhotoMeasurementType;
  confidence: PhotoAnalysisConfidence;
  photoRef: string;
}

export interface PhotoAnalysis {
  id: string;
  leadId: string;
  serviceId: string;
  summary: string;
  observations: string[];
  scopeAssessment: string;
  costIndicators: string;
  safetyConcerns: string[];
  additionalInfo: string[];
  confidenceLevel: PhotoAnalysisConfidence;
  photoCount: number;
  measurements: PhotoMeasurement[];
  needsOnsiteMeasurement: string[];
  discrepancies: string[];
  extractedText: string[];
  suggestedSearchTerms: string[];
  createdAt: string;
}

export interface TimelinePhotoAnalysisSummary {
  photoCount: number;
  confidenceLevel: string;
  observations: string[];
  scopeAssessment: string;
  costIndicators: string;
  safetyConcerns: string[];
  measurements: { description: string; value: number; unit: string; type: string; confidence: string }[];
  needsOnsiteMeasurement: string[];
  discrepancies: string[];
  extractedText: string[];
  suggestedSearchTerms: string[];
  hasOcrEvidence: boolean;
  hasOnsiteRequirement: boolean;
}

export interface PhotoAnalysisResponse {
  analysis: PhotoAnalysis | null;
}

// Call Logger types
export interface LogCallRequest {
  summary: string;
  sendConfirmationEmail?: boolean;
}

export interface LogCallResponse {
  noteCreated: boolean;
  statusUpdated?: string;
  appointmentBooked?: string; // ISO 8601 date string
  message: string;
}

// Attachment types for lead service file uploads
export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: number; // Unix timestamp
}

export interface CreateAttachmentRequest {
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface Attachment {
  id: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy?: string;
  createdAt: string;
  downloadUrl?: string;
}

// Alias for backward compatibility
export type LeadServiceAttachment = Attachment;

export interface AttachmentListResponse {
  items: Attachment[];
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresAt: number; // Unix timestamp
}

// Allowed file types for uploads
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav'],
} as const;

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.video,
  ...ALLOWED_FILE_TYPES.audio,
];

export const MAX_FILE_SIZE_BYTES = 104857600; // 100MB
