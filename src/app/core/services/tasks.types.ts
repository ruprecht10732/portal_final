export type TaskScope = 'global' | 'lead_service';
export type TaskStatus = 'open' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskReminder {
  id: string;
  taskId: string;
  tenantId: string;
  enabled: boolean;
  sendEmail: boolean;
  sendWhatsApp: boolean;
  nextRunAt: string | null;
  repeatDaily: boolean;
  lastSentAt: string | null;
  lastTriggeredAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  tenantId: string;
  scopeType: TaskScope;
  leadId: string | null;
  leadServiceId: string | null;
  assignedUserId: string;
  createdByUserId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeEmail: string;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  reminder: TaskReminder | null;
}

export interface ListTasksParams {
  scope?: TaskScope;
  status?: TaskStatus;
  assignedUserId?: string;
  leadId?: string;
  leadServiceId?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface TaskReminderRequest {
  enabled: boolean;
  runAt?: string;
  repeatDaily?: boolean;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
}

export interface CreateTaskRequest {
  scopeType: TaskScope;
  leadId?: string;
  leadServiceId?: string;
  assignedUserId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string;
  reminder?: TaskReminderRequest;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string;
  clearDueAt?: boolean;
  assignedUserId?: string;
  reminder?: TaskReminderRequest;
  clearReminder?: boolean;
}

export interface TaskListResponse {
  items: TaskItem[];
}