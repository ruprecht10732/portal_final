/**
 * Represents the current lifecycle state of an agent's request for human intervention.
 */
export type AgentApprovalDecision = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AgentApproval {
  readonly id: string;
  readonly agentName: string;
  readonly toolName: string;
  
  /** The arguments passed to the tool by the AI Agent. */
  readonly arguments: Record<string, unknown> | null;
  
  /** The justification provided by the agent for why this action is necessary. */
  readonly reason: string;
  
  /** ISO 8601 Timestamp of the initial request. */
  readonly requestedAt: string;
  readonly expiresAt: string | null;
  
  readonly decision: AgentApprovalDecision;
  
  /** The timestamp when a human made the decision. Null if pending. */
  readonly decidedAt: string | null;
  
  /** The UID of the user who approved/rejected the request. Null if pending. */
  readonly decidedBy: string | null;
  
  readonly leadId: string | null;
  readonly serviceId: string | null;
  readonly tenantId: string;
  readonly createdAt: string;
}

export interface AgentApprovalCountResponse {
  readonly count: number;
}

export interface ApproveRejectRequest {
  /** * An optional reason provided by the human for the approval/rejection.
   * Marked as optional/undefined to satisfy exactOptionalPropertyTypes.
   */
  reason?: string | undefined;
}

/**
 * Standard response for write operations in the approval workflow.
 */
export interface ApproveRejectResponse {
  /** * Fixed S6571: We use (string & {}) to prevent the union from collapsing.
   * This provides IDE autocompletion for 'success' and 'error' while still 
   * allowing any other string response from the backend.
   */
  readonly status: 'success' | 'error' | (string & {});
}