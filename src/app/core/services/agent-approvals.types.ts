export type AgentApprovalDecision = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AgentApproval {
  id: string;
  agentName: string;
  toolName: string;
  arguments?: Record<string, unknown> | null;
  reason: string;
  requestedAt: string;
  expiresAt?: string | null;
  decision: AgentApprovalDecision;
  decidedAt?: string | null;
  decidedBy?: string | null;
  leadId?: string | null;
  serviceId?: string | null;
  tenantId: string;
  createdAt: string;
}

export interface AgentApprovalCountResponse {
  count: number;
}

export interface ApproveRejectRequest {
  reason?: string | undefined;
}

export interface ApproveRejectResponse {
  status: string;
}
