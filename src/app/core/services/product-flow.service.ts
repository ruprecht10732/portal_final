import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductFlow {
  id: string;
  productGroupId: string;
  version: number;
  isGlobal: boolean;
  definition: unknown;
}

export interface ProductFlowListResponse {
  items: ProductFlow[];
}

export interface CreateProductFlowRequest {
  productGroupId: string;
  definition: unknown;
}

export interface UpdateProductFlowRequest {
  definition: unknown;
}

@Injectable({ providedIn: 'root' })
export class ProductFlowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/product-flows`;

  list(): Observable<ProductFlowListResponse> {
    return this.http.get<ProductFlowListResponse>(this.baseUrl);
  }

  create(payload: CreateProductFlowRequest): Observable<ProductFlow> {
    return this.http.post<ProductFlow>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateProductFlowRequest): Observable<ProductFlow> {
    return this.http.put<ProductFlow>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  duplicate(id: string): Observable<ProductFlow> {
    return this.http.post<ProductFlow>(`${this.baseUrl}/${id}/duplicate`, {});
  }
}
