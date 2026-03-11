import type { SuggestReplyRequest } from './reply-suggestion.types';

export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: string;
  roles: string[];
  hasOrganization: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
}

export interface UpdateProfileRequest {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredLanguage?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CompleteOnboardingRequest {
  firstName: string;
  lastName: string;
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  vatNumber?: string;
  kvkNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface IMAPAccount {
  id: string;
  userId: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  smtpConfigured: boolean;
  folderName: string;
  enabled: boolean;
  lastSyncAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIMAPAccountRequest {
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  folderName?: string;
  enabled?: boolean;
}

export interface UpdateIMAPAccountRequest {
  emailAddress?: string;
  imapHost?: string;
  imapPort?: number;
  imapUsername?: string;
  imapPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  folderName?: string;
  enabled?: boolean;
}

export interface IMAPMessage {
  id: string;
  accountId: string;
  folderName: string;
  uid: number;
  messageId?: string | null;
  fromName?: string | null;
  fromAddress?: string | null;
  subject: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  snippet?: string | null;
  sizeBytes: number;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  deleted: boolean;
  hasAttachments: boolean;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMAPMessageListResponse {
  items: IMAPMessage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IMAPUnreadCountResponse {
  count: number;
}

export interface DetectIMAPAccountResponse {
  detected: boolean;
  provider?: string;
  host?: string;
  port?: number;
  username?: string;
  security?: string;
}

export interface IMAPMessageContent {
  accountId: string;
  uid: number;
  messageId?: string | null;
  linkedLead?: InboxLeadSummary | null;
  suggestedLead?: InboxLeadSummary | null;
  subject: string;
  fromName?: string | null;
  fromAddress?: string | null;
  replyTo?: string[] | null;
  to?: string[] | null;
  cc?: string[] | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
}

export interface SendIMAPMessageRequest {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  inReplyToUid?: number;
}

export interface ReplyIMAPMessageRequest {
  body: string;
  aiSuggestion?: string;
  scenario?: string;
  isHtml?: boolean;
}

export interface SuggestIMAPReplyResponse {
  suggestion: string;
  effectiveScenario: string;
}

export interface ReplyScenarioAnalyticsItem {
  scenario: string;
  sentCount: number;
  editedCount: number;
  editRate: number;
  lastUsedAt?: string | null;
}

export type SuggestIMAPReplyRequest = SuggestReplyRequest;

export interface InboxLeadSummary {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  city?: string | null;
}

export interface LinkIMAPMessageLeadRequest {
  leadId: string;
}

export interface IMAPMessageLeadLinkResponse {
  status: string;
  linkedLead?: InboxLeadSummary | null;
  suggestedLead?: InboxLeadSummary | null;
}
