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

export interface WhatsAppPortalMetadata {
  originalBody?: string;
  edited?: WhatsAppPortalMutationAudit;
  deleted?: WhatsAppPortalMutationAudit;
  revoked?: WhatsAppPortalMutationAudit;
  reactions?: WhatsAppPortalReaction[];
}

export interface WhatsAppMessageMetadata {
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

export interface SendWhatsAppConversationMessageRequest {
  body: string;
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