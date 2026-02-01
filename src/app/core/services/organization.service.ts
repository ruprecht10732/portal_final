import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
}
