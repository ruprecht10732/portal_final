import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, finalize, map, of, startWith, switchMap, tap } from 'rxjs';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { SearchService } from '../../core/services/search.service';
import { UserService } from '../../core/services/user.service';
import type { UserProfile } from '../../core/services/user.types';
import type { SearchEntityType, SearchResponse, SearchResultItem } from '../../core/services/search.types';

interface SearchSection {
  type: SearchEntityType;
  items: SearchResultItem[];
}

interface RecentSearch {
  query: string;
  date: string; // ISO date string
}

@Component({
  selector: 'app-search',
  imports: [
    RouterLink,
    TranslatePipe,
    PageLayoutComponent,
    SkeletonComponent,
  ],
  templateUrl: './search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent {
  private readonly searchService = inject(SearchService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly STORAGE_KEY = 'portal:search:recent';
  private readonly MAX_RECENT = 10;

  protected readonly query = signal(this.route.snapshot.queryParamMap.get('q')?.trim() ?? '');
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>(this.loadRecent());

  protected readonly selectedType = signal<SearchEntityType | 'all'>('all');

  private readonly profile = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null as UserProfile | null },
  );

  protected readonly isAdmin = computed(() => this.profile()?.roles?.includes('admin') ?? false);

  private readonly emptyResponse: SearchResponse = { items: [], total: 0 };

  protected readonly trimmedQuery = computed(() => this.query().trim());
  protected readonly isQueryValid = computed(() => this.trimmedQuery().length >= 2);

  protected readonly activeTypesParam = computed(() => {
    const selected = this.selectedType();
    return selected === 'all' ? undefined : selected;
  });

  protected readonly response = toSignal(
    combineLatest([
      toObservable(this.query),
      toObservable(this.activeTypesParam),
    ]).pipe(
      map(([value, types]) => ({ q: value.trim(), types })),
      debounceTime(250),
      distinctUntilChanged((a, b) => a.q === b.q && a.types === b.types),
      tap(() => {
        this.error.set(null);
      }),
      switchMap(({ q, types }) => {
        if (q.length < 2) {
          this.isLoading.set(false);
          return of(this.emptyResponse);
        }

        this.isLoading.set(true);
        const params = types ? { q, limit: 20, types } : { q, limit: 20 };
        return this.searchService.globalSearch(params).pipe(
          tap((response) => {
            if ((response.items?.length ?? 0) > 0) {
              this.addToRecent(q);
            }
          }),
          catchError((err) => {
            const apiError = err?.error;
            const details = typeof apiError?.details === 'string' ? apiError.details : null;
            const message = typeof apiError?.error === 'string' ? apiError.error : null;
            this.error.set(details ?? message ?? 'search.error');
            return of(this.emptyResponse);
          }),
          finalize(() => this.isLoading.set(false)),
        );
      }),
      startWith(this.emptyResponse),
      takeUntilDestroyed(this.destroyRef),
    ),
    { initialValue: this.emptyResponse },
  );

  protected readonly items = computed(() => this.response().items ?? []);

  protected readonly sections = computed<SearchSection[]>(() => {
    const allItems = this.items();
    if (allItems.length === 0) return [];

    const order: SearchEntityType[] = ['lead', 'quote', 'appointment', 'partner', 'catalog_product', 'service_type'];
    return order
      .map((type) => ({
        type,
        items: allItems.filter((item) => item.type === type),
      }))
      .filter((section) => section.items.length > 0);
  });

  protected readonly typeChips = computed(() => {
    const base: { value: SearchEntityType | 'all'; labelKey: string }[] = [
      { value: 'all' as const, labelKey: 'search.filters.all' },
      { value: 'lead' as const, labelKey: 'search.sections.lead' },
      { value: 'quote' as const, labelKey: 'search.sections.quote' },
      { value: 'appointment' as const, labelKey: 'search.sections.appointment' },
      { value: 'partner' as const, labelKey: 'search.sections.partner' },
      { value: 'catalog_product' as const, labelKey: 'search.sections.catalog_product' },
    ];

    if (this.isAdmin()) {
      base.push({ value: 'service_type' as const, labelKey: 'search.sections.service_type' });
    }

    return base;
  });

  protected setSelectedType(type: SearchEntityType | 'all'): void {
    this.selectedType.set(type);
  }

  protected readonly showRecent = computed(
    () => this.trimmedQuery().length === 0 && this.recentSearches().length > 0,
  );
  protected readonly showMinCharsHint = computed(
    () => this.trimmedQuery().length > 0 && !this.isQueryValid(),
  );
  protected readonly showNoResults = computed(
    () => this.isQueryValid() && !this.isLoading() && this.items().length === 0 && !this.error(),
  );

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (!value.trim()) {
      this.isLoading.set(false);
      this.error.set(null);
    }
  }

  protected onEnterSearch(): void {
    const q = this.trimmedQuery();
    if (q.length >= 2) this.addToRecent(q);
  }

  protected onResultClick(): void {
    this.addToRecent(this.trimmedQuery());
  }

  protected clearQuery(): void {
    this.query.set('');
    this.isLoading.set(false);
    this.error.set(null);
  }

  protected removeRecent(query: string, event: Event): void {
    event.stopPropagation();
    const updated = this.recentSearches().filter((r) => r.query !== query);
    this.recentSearches.set(updated);
    try {
      if (updated.length === 0) {
        localStorage.removeItem(this.STORAGE_KEY);
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  }

  protected onRecentClick(q: string): void {
    this.query.set(q);
  }

  protected clearAllRecent(): void {
    this.recentSearches.set([]);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  protected buildLink(item: SearchResultItem): string {
    if (item.link) return item.link;

    switch (item.type) {
      case 'lead':
        return `/app/leads/${encodeURIComponent(item.id)}`;
      case 'quote':
        return `/app/offertes/${encodeURIComponent(item.id)}`;
      case 'partner':
        return `/app/partners/${encodeURIComponent(item.id)}`;
      case 'appointment':
        return `/app/appointments/${encodeURIComponent(item.id)}`;
      case 'catalog_product':
        return `/app/catalog/${encodeURIComponent(item.id)}`;
      case 'service_type':
        return `/app/services/${encodeURIComponent(item.id)}`;
      default:
        return '/app';
    }
  }

  protected typeLabelKey(type: SearchEntityType): string {
    return `search.types.${type}`;
  }

  protected sectionLabelKey(type: SearchEntityType): string {
    return `search.sections.${type}`;
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Vandaag';
    if (date.toDateString() === yesterday.toDateString()) return 'Gisteren';

    const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  private loadRecent(): RecentSearch[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    } catch {
      return [];
    }
  }

  private addToRecent(q: string): void {
    const trimmed = q.trim();
    if (!trimmed) return;
    const existing = this.recentSearches().filter(
      (r) => r.query.toLowerCase() !== trimmed.toLowerCase(),
    );
    const updated = [{ query: trimmed, date: new Date().toISOString() }, ...existing].slice(
      0,
      this.MAX_RECENT,
    );
    this.recentSearches.set(updated);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }
}

