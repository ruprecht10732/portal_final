import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { LeadsService } from '../../core/services/leads.service';
import type { LeadListResponse } from '../../core/services/leads.types';
import { DEFAULT_PAGE_SIZE } from '../../core/config';

export const leadsListResolver: ResolveFn<LeadListResponse> = () => {
  const leadsService = inject(LeadsService);
  return leadsService.list({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
};