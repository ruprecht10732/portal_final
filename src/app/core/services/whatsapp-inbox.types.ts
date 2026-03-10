export interface WhatsAppConversation {
  id: string;
  leadId?: string | null;
  phoneNumber: string;
  displayName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastMessageDirection: 'inbound' | 'outbound';
  lastMessageStatus: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppPortalMutationAudit {
  actorJid?: string;
  actorName?: string;
  eventMessageId?: string;
  occurredAt?: string;
  isFromMe?: boolean;
}

export interface WhatsAppPortalReaction extends WhatsAppPortalMutationAudit {
  reaction?: string;
}

export interface WhatsAppPortalAttachment {
  filename?: string;
  remoteUrl?: string;
  path?: string;
  hasInlineData?: boolean;
  mediaType?: string;
}

export interface WhatsAppPortalContact {
  name?: string;
  phone?: string;
}

export interface WhatsAppPortalReply {
  messageId?: string;
  body?: string;
}

export interface WhatsAppPortalLocation {
  latitude?: string;
  longitude?: string;
  name?: string;
  address?: string;
  live?: boolean;
}

export interface WhatsAppPortalPoll {
  question?: string;
  options?: string[];
  maxAnswer?: number | string;
  selectedOptions?: string[];
}

export interface WhatsAppWebhookMediaObject {
  path?: string;
  url?: string;
  caption?: string;
  filename?: string;
}

export type WhatsAppWebhookMediaValue = string | WhatsAppWebhookMediaObject;

export interface WhatsAppWebhookContact {
  displayName?: string;
  vcard?: string;
}

export interface WhatsAppWebhookLocation {
  degreesLatitude?: string | number;
  degreesLongitude?: string | number;
  name?: string;
  address?: string;
}

export interface WhatsAppWebhookPayload {
  body?: string;
  replied_to_id?: string;
  quoted_body?: string;
  image?: WhatsAppWebhookMediaValue;
  video?: WhatsAppWebhookMediaValue;
  audio?: WhatsAppWebhookMediaValue;
  document?: WhatsAppWebhookMediaValue;
  sticker?: WhatsAppWebhookMediaValue;
  video_note?: WhatsAppWebhookMediaValue;
  location?: WhatsAppWebhookLocation;
  live_location?: WhatsAppWebhookLocation;
  contact?: WhatsAppWebhookContact;
  contacts_array?: WhatsAppWebhookContact[];
  question?: string;
  options?: string[];
  max_answer?: number | string;
  poll?: Record<string, unknown>;
  poll_update?: Record<string, unknown>;
  selected_options?: string[];
  selected_option_names?: string[];
  selectedOptions?: string[];
  selectedOptionNames?: string[];
  view_once?: boolean;
  forwarded?: boolean;
  [key: string]: unknown;
}

export interface WhatsAppPortalMetadata {
  originalBody?: string;
  messageType?: string;
  text?: string;
  caption?: string;
  attachment?: WhatsAppPortalAttachment;
  contact?: WhatsAppPortalContact;
  contacts?: WhatsAppPortalContact[];
  reply?: WhatsAppPortalReply;
  link?: string;
  location?: WhatsAppPortalLocation;
  poll?: WhatsAppPortalPoll;
  viewOnce?: boolean;
  compress?: boolean;
  isForwarded?: boolean;
  pushToTalk?: boolean;
  durationSeconds?: number;
  edited?: WhatsAppPortalMutationAudit;
  deleted?: WhatsAppPortalMutationAudit;
  revoked?: WhatsAppPortalMutationAudit;
  reactions?: WhatsAppPortalReaction[];
}

export interface WhatsAppMessageMetadata {
  event?: string;
  device_id?: string;
  timestamp?: string;
  payload?: WhatsAppWebhookPayload;
  portal?: WhatsAppPortalMetadata;
  lastMutationEvent?: string;
  lastMutationPayload?: unknown;
  [key: string]: unknown;
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  leadId?: string | null;
  externalMessageId?: string | null;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  phoneNumber: string;
  body: string;
  metadata?: WhatsAppMessageMetadata | null;
  sentAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
}

export interface WhatsAppConversationListResponse {
  conversations: WhatsAppConversation[];
}

export interface WhatsAppConversationMessagesResponse {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
}

export type WhatsAppMessageComposerType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'sticker'
  | 'contact'
  | 'link'
  | 'location'
  | 'poll';

export interface SendWhatsAppConversationAttachmentRequest {
  filename?: string;
  base64Data?: string;
  remoteUrl?: string;
}

export interface SendWhatsAppConversationMessageRequest {
  type?: WhatsAppMessageComposerType;
  body?: string;
  aiSuggestion?: string;
  caption?: string;
  viewOnce?: boolean;
  compress?: boolean;
  isForwarded?: boolean;
  pushToTalk?: boolean;
  attachment?: SendWhatsAppConversationAttachmentRequest;
  contactName?: string;
  contactPhone?: string;
  link?: string;
  latitude?: string;
  longitude?: string;
  question?: string;
  options?: string[];
  maxAnswer?: number;
  durationSeconds?: number;
}

export type WhatsAppPresenceType = 'available' | 'unavailable';

export type WhatsAppChatPresenceAction = 'start' | 'stop';

export interface SendWhatsAppPresenceRequest {
  type: WhatsAppPresenceType;
}

export interface SendWhatsAppChatPresenceRequest {
  action: WhatsAppChatPresenceAction;
}

export interface SendWhatsAppConversationMessageResponse {
  status: string;
  conversation: WhatsAppConversation;
  message: WhatsAppMessage;
}

export interface SuggestWhatsAppReplyResponse {
  suggestion: string;
}

export interface MarkWhatsAppConversationReadResponse {
  status: string;
  providerSynced: boolean;
}

export interface SendWhatsAppPresenceResponse {
  status: string;
}

export interface SendWhatsAppChatPresenceResponse {
  status: string;
}

export interface WhatsAppUnreadConversationCountResponse {
  count: number;
}