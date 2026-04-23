import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { withAccountUID } from '../interceptors/account-request-context';
import { AccountRegistryService } from './account-registry.service';
import type { Lead } from './leads.types';
import { OrganizationService } from './organization.service';
import type { QuoteResponse } from './quotes.types';
import { UserService } from './user.service';

export interface TransferDestinationAccount {
  uid: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

export interface LeadTransferResult {
  destination: TransferDestinationAccount;
  createdLeadId: string;
}

export interface QuoteTransferResult {
  destination: TransferDestinationAccount;
  createdLeadId: string;
  createdQuoteId: string;
  sourceLeadDeleted: boolean;
}

@Injectable({ providedIn: 'root' })
export class CrossOrgTransferService {
  private readonly http = inject(HttpClient);
  private readonly accounts = inject(AccountRegistryService);
  private readonly users = inject(UserService);
  private readonly organizations = inject(OrganizationService);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  /**
   * Scans all inactive accounts to find valid transfer destinations.
   * Executes network requests in parallel using forkJoin.
   */
  listDestinationAccounts(): Observable<TransferDestinationAccount[]> {
    const activeUID = this.accounts.activeAccount()?.uid;
    const candidates = this.accounts.accounts().filter(
      account => !account.isExpired && account.uid !== activeUID
    );

    if (candidates.length === 0) {
      return of([]);
    }

    const verificationRequests = candidates.map(account => 
      this.verifyDestinationCandidate(account.uid, account.email).pipe(
        catchError(() => of(null)) // Gracefully ignore accounts that fail verification
      )
    );

    return forkJoin(verificationRequests).pipe(
      map(results => results.filter((item): item is TransferDestinationAccount => item !== null)),
      // FIX: Spread the array to prevent mutating the stream in-place (SonarLint S4043)
      map(results => [...results].sort((a, b) => 
        a.organizationName.localeCompare(b.organizationName, undefined, { sensitivity: 'base' })
      ))
    );
  }

  transferLead(lead: Lead, destinationUID: string): Observable<LeadTransferResult> {
    return this.resolveDestination(destinationUID).pipe(
      switchMap(destination => 
        this.http.post<{ lead: Lead; destinationOrganizationId: string }>(
          `${this.apiBaseUrl}/admin/leads/${lead.id}/transfer`, 
          { destinationOrganizationId: destination.organizationId }
        ).pipe(
          map(response => ({
            destination,
            createdLeadId: response.lead.id,
          }))
        )
      )
    );
  }

  // FIX: Renamed 'p0' to '_lead' so TypeScript ignores the unused variable, but keeps the signature intact
  transferQuote(quote: QuoteResponse, _lead: Lead | null, destinationUID: string): Observable<QuoteTransferResult> {
    return this.resolveDestination(destinationUID).pipe(
      switchMap(destination => 
        this.http.post<{
          quote: QuoteResponse;
          destinationLeadId: string;
          destinationOrganizationId: string;
          sourceLeadDeleted: boolean;
        }>(
          `${this.apiBaseUrl}/admin/quotes/${quote.id}/transfer`, 
          { destinationOrganizationId: destination.organizationId }
        ).pipe(
          map(response => ({
            destination,
            createdLeadId: response.destinationLeadId,
            createdQuoteId: response.quote.id,
            sourceLeadDeleted: response.sourceLeadDeleted,
          }))
        )
      )
    );
  }

  // --- Private Implementation Details ---

  /**
   * Directly validates a SINGLE destination UID without iterating over all accounts.
   * Changes O(N) network calls to O(1).
   */
  private resolveDestination(destinationUID: string): Observable<TransferDestinationAccount> {
    const account = this.accounts.getAccount(destinationUID);
    
    if (!account || account.isExpired) {
      return throwError(() => new Error('Destination account is not available or expired.'));
    }

    return this.verifyDestinationCandidate(account.uid, account.email).pipe(
      map(destination => {
        if (!destination) {
          throw new Error('Destination account lacks admin privileges or organization context.');
        }
        return destination;
      })
    );
  }

  /**
   * Executes parallel profile and organization fetches for a specific context.
   */
  private verifyDestinationCandidate(uid: string, email: string): Observable<TransferDestinationAccount | null> {
    const context = withAccountUID(uid);

    return forkJoin({
      profile: this.users.getProfile({ context }),
      organization: this.organizations.getOrganization({ context })
    }).pipe(
      map(({ profile, organization }) => {
        if (!profile.roles.includes('admin')) {
          return null;
        }

        return {
          uid,
          email,
          organizationId: organization.id,
          organizationName: organization.name,
        };
      })
    );
  }
}