import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

export function themeColor(variableName: string): string {
  if (typeof document === 'undefined') {
    return 'currentColor';
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || 'currentColor';
}

export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  return `${first} ${last}`.trim() || '—';
}

export function loadAllPages<T>(
  fetchPage: (params: { page: number; pageSize: number }) => Observable<{ page: number; totalPages: number; items: T[] }>,
  pageSize: number,
  maxPages: number,
): Observable<{ items: T[]; truncated: boolean }> {
  return fetchPage({ page: 1, pageSize }).pipe(
    expand(response =>
      response.page < response.totalPages && response.page < maxPages
        ? fetchPage({ page: response.page + 1, pageSize })
        : EMPTY,
    ),
    reduce(
      (acc, response) => ({
        items: [...acc.items, ...(response.items ?? [])],
        lastPage: response.page,
        totalPages: response.totalPages,
      }),
      { items: [] as T[], lastPage: 0, totalPages: 0 },
    ),
    map(acc => ({
      items: acc.items,
      truncated: acc.lastPage < acc.totalPages,
    })),
  );
}
