/**
 * Data Grid Deep Linking Service
 * Syncs grid state (pagination, sorting, filtering) with URL query params
 */

import { Injectable, inject, signal, OnDestroy, Injector } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SortConfig, FilterConfig, PaginationConfig } from './data-grid.types';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

export interface DeepLinkConfig {
  /** Enable URL sync */
  enabled: boolean;
  /** Prefix for query params (e.g., 'grid_' -> 'grid_page', 'grid_sort') */
  paramPrefix?: string;
  /** Debounce time for URL updates (ms) */
  debounceMs?: number;
  /** Persist to sessionStorage as backup */
  persistToStorage?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

export interface GridUrlState {
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, string>;
  search?: string;
}

@Injectable()
export class DataGridDeepLinkService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  
  private config: DeepLinkConfig | null = null;
  private subscription: Subscription | null = null;
  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  
  /** Current state parsed from URL */
  readonly urlState = signal<GridUrlState>({});
  
  /** Whether initial state has been loaded from URL */
  readonly initialized = signal(false);

  /**
   * Initialize deep linking with configuration
   */
  initialize(config: DeepLinkConfig): void {
    this.config = {
      paramPrefix: '',
      debounceMs: 300,
      persistToStorage: false,
      ...config,
    };

    if (!this.config.enabled) return;

    // Parse initial URL state
    this.parseUrlState(this.route.snapshot.queryParams);
    this.initialized.set(true);

    // Subscribe to query param changes
    this.subscription = this.route.queryParams.pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(params => {
      this.parseUrlState(params);
    });
  }

  /**
   * Update URL with current grid state
   */
  updateUrl(state: {
    pagination?: PaginationConfig;
    sort?: SortConfig;
    filters?: FilterConfig[];
    searchTerm?: string;
  }): void {
    if (!this.config?.enabled) return;

    // Debounce URL updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.doUpdateUrl(state);
    }, this.config.debounceMs);
  }

  /**
   * Get initial grid state from URL
   */
  getInitialState(): {
    page: number;
    pageSize: number;
    sort?: SortConfig;
    filters?: FilterConfig[];
    searchTerm?: string;
  } {
    const state = this.urlState();
    
    const result: ReturnType<typeof this.getInitialState> = {
      page: state.page ?? 1,
      pageSize: state.pageSize ?? 20,
    };

    if (state.sortColumn) {
      result.sort = {
        columnId: state.sortColumn,
        direction: state.sortDirection ?? 'asc',
      };
    }

    if (state.filters) {
      result.filters = Object.entries(state.filters).map(([columnId, value]) => ({
        columnId,
        operator: 'contains' as const,
        value,
      }));
    }

    if (state.search) {
      result.searchTerm = state.search;
    }

    return result;
  }

  /**
   * Clear all grid params from URL
   */
  clearUrl(): void {
    if (!this.config?.enabled) return;

    const prefix = this.config.paramPrefix ?? '';
    const currentParams = { ...this.route.snapshot.queryParams };
    const keysToRemove = [
      `${prefix}page`,
      `${prefix}pageSize`,
      `${prefix}sort`,
      `${prefix}sortDir`,
      `${prefix}search`,
    ];

    // Remove filter params
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith(`${prefix}f_`)) {
        keysToRemove.push(key);
      }
    });

    const newParams: Params = {};
    Object.keys(currentParams).forEach(key => {
      if (!keysToRemove.includes(key)) {
        newParams[key] = currentParams[key];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });

    if (this.config.persistToStorage && this.config.storageKey) {
      sessionStorage.removeItem(this.config.storageKey);
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }

  private parseUrlState(params: Params): void {
    const prefix = this.config?.paramPrefix ?? '';
    
    const state: GridUrlState = {};

    // Parse pagination
    const page = params[`${prefix}page`];
    if (page) {
      const pageNum = Number.parseInt(page, 10);
      if (!Number.isNaN(pageNum) && pageNum > 0) {
        state.page = pageNum;
      }
    }

    const pageSize = params[`${prefix}pageSize`];
    if (pageSize) {
      const size = Number.parseInt(pageSize, 10);
      if (!Number.isNaN(size) && size > 0) {
        state.pageSize = size;
      }
    }

    // Parse sorting
    const sortColumn = params[`${prefix}sort`];
    if (sortColumn) {
      state.sortColumn = sortColumn;
      state.sortDirection = params[`${prefix}sortDir`] === 'desc' ? 'desc' : 'asc';
    }

    // Parse search
    const search = params[`${prefix}search`];
    if (search) {
      state.search = search;
    }

    // Parse filters (prefixed with f_)
    const filters: Record<string, string> = {};
    Object.keys(params).forEach(key => {
      if (key.startsWith(`${prefix}f_`)) {
        const field = key.slice((`${prefix}f_`).length);
        filters[field] = params[key];
      }
    });
    if (Object.keys(filters).length > 0) {
      state.filters = filters;
    }

    this.urlState.set(state);

    // Backup to storage
    if (this.config?.persistToStorage && this.config.storageKey) {
      sessionStorage.setItem(this.config.storageKey, JSON.stringify(state));
    }
  }

  private doUpdateUrl(state: {
    pagination?: PaginationConfig;
    sort?: SortConfig;
    filters?: FilterConfig[];
    searchTerm?: string;
  }): void {
    const prefix = this.config?.paramPrefix ?? '';
    const currentParams = { ...this.route.snapshot.queryParams };
    const newParams: Params = {};

    // Preserve non-grid params
    Object.keys(currentParams).forEach(key => {
      const isGridParam = key === `${prefix}page` ||
        key === `${prefix}pageSize` ||
        key === `${prefix}sort` ||
        key === `${prefix}sortDir` ||
        key === `${prefix}search` ||
        key.startsWith(`${prefix}f_`);
      
      if (!isGridParam) {
        newParams[key] = currentParams[key];
      }
    });

    // Add pagination
    if (state.pagination) {
      if (state.pagination.page > 1) {
        newParams[`${prefix}page`] = state.pagination.page.toString();
      }
      if (state.pagination.pageSize !== 20) {
        newParams[`${prefix}pageSize`] = state.pagination.pageSize.toString();
      }
    }

    // Add sorting
    if (state.sort?.columnId) {
      newParams[`${prefix}sort`] = state.sort.columnId;
      if (state.sort.direction === 'desc') {
        newParams[`${prefix}sortDir`] = 'desc';
      }
    }

    // Add search
    if (state.searchTerm) {
      newParams[`${prefix}search`] = state.searchTerm;
    }

    // Add filters
    if (state.filters) {
      state.filters.forEach(filter => {
        if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
          newParams[`${prefix}f_${filter.columnId}`] = String(filter.value);
        }
      });
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
