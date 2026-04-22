import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, Observable, switchMap, tap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AgentApproval, AgentApprovalCountResponse, ApproveRejectRequest, ApproveRejectResponse } from './agent-approvals.types';

@Injectable({ providedIn: 'root' })
export class AgentApprovalsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/leads/agent-approvals`;

  /** Reactive count of pending approvals, polled every 30s. */
  readonly pendingCount = signal<number>(0);

  /** Load a single page of pending approvals. */
  listPending(limit = 50, offset = 0): Observable<AgentApproval[]> {
    return this.http.get<AgentApproval[]>(this.baseUrl, {
      params: { limit: String(limit), offset: String(offset) },
    });
  }

  /** Fetch total pending count. */
  getPendingCount(): Observable<AgentApprovalCountResponse> {
    return this.http.get<AgentApprovalCountResponse>(`${this.baseUrl}/count`);
  }

  /** Fetch a single approval by ID. */
  getById(id: string): Observable<AgentApproval> {
    return this.http.get<AgentApproval>(`${this.baseUrl}/${id}`);
  }

  /** Approve a pending approval. */
  approve(id: string, reason?: string): Observable<ApproveRejectResponse> {
    const body: ApproveRejectRequest = { reason };
    return this.http.post<ApproveRejectResponse>(`${this.baseUrl}/${id}/approve`, body);
  }

  /** Reject a pending approval. */
  reject(id: string, reason?: string): Observable<ApproveRejectResponse> {
    const body: ApproveRejectRequest = { reason };
    return this.http.post<ApproveRejectResponse>(`${this.baseUrl}/${id}/reject`, body);
  }

  /** Start polling the pending count every `intervalMs`. Returns a teardown function. */
  startPollingCount(intervalMs = 30000): () => void {
    const sub = timer(0, intervalMs)
      .pipe(
        switchMap(() =>
          this.getPendingCount().pipe(
            tap((res) => this.pendingCount.set(res.count)),
            catchError(() => EMPTY),
          ),
        ),
      )
      .subscribe();

    return () => sub.unsubscribe();
  }
}
