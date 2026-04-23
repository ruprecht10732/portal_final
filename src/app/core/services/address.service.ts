import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';
import { withAccountUID } from '../interceptors/account-request-context';

export interface AddressSuggestion {
  label: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  lat?: string;
  lon?: string;
  state?: string;
  country?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/maps/address-lookup`;
  
  private readonly cache = new Map<string, AddressSuggestion[]>();

  search(query: string, accountUid?: string): Observable<AddressSuggestion[]> {
    const sanitizedQuery = query.trim().toLowerCase();

    if (sanitizedQuery.length < 3) {
      return of([]);
    }

    const cached = this.cache.get(sanitizedQuery);
    if (cached) {
      return of(cached);
    }

    const params = toHttpParams({ q: sanitizedQuery });

    /**
     * Fix for TS2769 & TS2322: 
     * Because 'exactOptionalPropertyTypes' is enabled, we cannot pass { context: undefined }.
     * We construct the options object dynamically to ensure the 'context' key is 
     * only present if it contains a valid HttpContext.
     */
    const options: { params: ReturnType<typeof toHttpParams>; context?: HttpContext } = { params };
    if (accountUid) {
      options.context = withAccountUID(accountUid);
    }

    return this.http.get<AddressSuggestion[]>(this.baseUrl, options).pipe(
      tap(results => {
        this.manageCache(sanitizedQuery, results);
      })
    );
  }

  private manageCache(query: string, results: AddressSuggestion[]): void {
    if (this.cache.size >= 50) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(query, results);
  }

  clearCache(): void {
    this.cache.clear();
  }
}