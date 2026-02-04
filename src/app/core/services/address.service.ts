import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toHttpParams } from '../utils/http-utils';

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

  search(query: string): Observable<AddressSuggestion[]> {
    const params = toHttpParams({ q: query });
    return this.http.get<AddressSuggestion[]>(this.baseUrl, { params });
  }
}
