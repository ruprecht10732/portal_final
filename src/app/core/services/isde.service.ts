import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ISDECalculationRequest, ISDECalculationResponse } from './isde.types';

@Injectable({ providedIn: 'root' })
export class IsdeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/isde`;

  calculate(payload: ISDECalculationRequest): Observable<ISDECalculationResponse> {
    return this.http.post<ISDECalculationResponse>(`${this.baseUrl}/calculate`, payload);
  }
}