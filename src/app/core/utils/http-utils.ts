import { HttpParams } from '@angular/common/http';

export function toHttpParams(
  params: Record<string, string | number | boolean | undefined | null>
): HttpParams {
  let httpParams = new HttpParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }

  return httpParams;
}
