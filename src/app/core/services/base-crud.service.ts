import { Observable } from 'rxjs';

export abstract class BaseCrudService<
  T,
  TListParams = unknown,
  TListResponse = unknown,
  TCreate = T,
  TUpdate = Partial<T>,
  TDeleteResponse = unknown
> {
  abstract list(params: TListParams): Observable<TListResponse>;
  abstract getById(id: string): Observable<T>;
  abstract create(data: TCreate): Observable<T>;
  abstract update(id: string, data: TUpdate): Observable<T>;
  abstract delete(id: string): Observable<TDeleteResponse>;
}
