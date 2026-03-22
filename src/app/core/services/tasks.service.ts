import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';
import type { CreateTaskRequest, ListTasksParams, TaskItem, TaskListResponse, UpdateTaskRequest } from './tasks.types';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  list(params: ListTasksParams): Observable<TaskListResponse> {
    const httpParams = toHttpParams({
      scope: params.scope,
      status: params.status,
      assignedUserId: params.assignedUserId,
      leadId: params.leadId,
      leadServiceId: params.leadServiceId,
      dueFrom: params.dueFrom,
      dueTo: params.dueTo,
    });
    return this.http.get<TaskListResponse>(this.baseUrl, { params: httpParams });
  }

  create(payload: CreateTaskRequest): Observable<TaskItem> {
    return this.http.post<TaskItem>(this.baseUrl, payload);
  }

  update(taskId: string, payload: UpdateTaskRequest): Observable<TaskItem> {
    return this.http.patch<TaskItem>(`${this.baseUrl}/${taskId}`, payload);
  }

  complete(taskId: string): Observable<TaskItem> {
    return this.http.post<TaskItem>(`${this.baseUrl}/${taskId}/complete`, {});
  }

  cancel(taskId: string): Observable<TaskItem> {
    return this.http.post<TaskItem>(`${this.baseUrl}/${taskId}/cancel`, {});
  }

  reopen(taskId: string): Observable<TaskItem> {
    return this.http.post<TaskItem>(`${this.baseUrl}/${taskId}/reopen`, {});
  }

  delete(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${taskId}`);
  }
}