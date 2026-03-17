import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withAccountUID } from '../interceptors/account-request-context';
import { AccountRegistryService } from './account-registry.service';
import type { Lead } from './leads.types';
import type { Organization } from './organization.service';
import { OrganizationService } from './organization.service';
import type { QuoteResponse } from './quotes.types';
import { UserService } from './user.service';
import type { UserProfile } from './user.types';

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

  listDestinationAccounts(): Observable<TransferDestinationAccount[]> {
    return from(this.listDestinationAccountsInternal());
  }

  transferLead(lead: Lead, destinationUID: string): Observable<LeadTransferResult> {
    return from(this.transferLeadInternal(lead, destinationUID));
  }

  transferQuote(quote: QuoteResponse, _lead: Lead | null, destinationUID: string): Observable<QuoteTransferResult> {
    return from(this.transferQuoteInternal(quote, null, destinationUID));
  }

  private async listDestinationAccountsInternal(): Promise<TransferDestinationAccount[]> {
    const activeUID = this.accounts.activeAccountValue?.uid ?? null;
    const candidates = this.accounts.accounts().filter(account => !account.isExpired && account.uid !== activeUID);

    const resolved = await Promise.all(
      candidates.map(async (account) => {
        const context = withAccountUID(account.uid);

        try {
          const [profile, organization] = await Promise.all([
            this.readProfile(context),
            this.readOrganization(context),
          ]);

          if (!this.isAdminProfile(profile)) {
            return null;
          }

          return {
            uid: account.uid,
            email: account.email,
            organizationId: organization.id,
            organizationName: organization.name,
          } satisfies TransferDestinationAccount;
        } catch {
          return null;
        }
      }),
    );

    return resolved
      .filter((item): item is TransferDestinationAccount => item !== null)
      .sort((left, right) => left.organizationName.localeCompare(right.organizationName, undefined, { sensitivity: 'base' }));
  }

  private async transferLeadInternal(lead: Lead, destinationUID: string): Promise<LeadTransferResult> {
    const destination = await this.resolveDestination(destinationUID);
    const response = await firstValueFrom(this.http.post<{
      lead: Lead;
      destinationOrganizationId: string;
    }>(`${this.apiBaseUrl}/admin/leads/${lead.id}/transfer`, {
      destinationOrganizationId: destination.organizationId,
    }));

    return {
      destination,
      createdLeadId: response.lead.id,
    };
  }

  private async transferQuoteInternal(quote: QuoteResponse, _lead: Lead | null, destinationUID: string): Promise<QuoteTransferResult> {
    const destination = await this.resolveDestination(destinationUID);
    const response = await firstValueFrom(this.http.post<{
      quote: QuoteResponse;
      destinationLeadId: string;
      destinationOrganizationId: string;
      sourceLeadDeleted: boolean;
    }>(`${this.apiBaseUrl}/admin/quotes/${quote.id}/transfer`, {
      destinationOrganizationId: destination.organizationId,
    }));

    return {
      destination,
      createdLeadId: response.destinationLeadId,
      createdQuoteId: response.quote.id,
      sourceLeadDeleted: response.sourceLeadDeleted,
    };
  }

  private async resolveDestination(destinationUID: string): Promise<TransferDestinationAccount> {
    const destinations = await this.listDestinationAccountsInternal();
    const destination = destinations.find(item => item.uid === destinationUID) ?? null;
    if (!destination) {
      throw new Error('Destination organization is not available');
    }

    return destination;
  }
  private isAdminProfile(profile: UserProfile): boolean {
    return profile.roles.includes('admin');
  }

  private readProfile(context: ReturnType<typeof withAccountUID>): Promise<UserProfile> {
    return firstValueFrom(this.users.getProfile({ context }));
  }

  private readOrganization(context: ReturnType<typeof withAccountUID>): Promise<Organization> {
    return firstValueFrom(this.organizations.getOrganization({ context }));
  }
}