import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ServiceTypeListResponse } from './service-types.types';

@Injectable({ providedIn: 'root' })
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/service-types`;

  listActive(): Observable<ServiceTypeListResponse> {
    return this.http.get<ServiceTypeListResponse>(this.baseUrl);
  }
}
