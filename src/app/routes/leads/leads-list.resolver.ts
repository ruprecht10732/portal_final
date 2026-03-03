import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { LeadsService } from '../../core/services/leads.service';
import { ServiceTypesService } from '../../core/services/service-types.service';
import { UserService } from '../../core/services/user.service';
import type { LeadListResponse } from '../../core/services/leads.types';
import type { ServiceTypeItem } from '../../core/services/service-types.types';
import type { UserSummary } from '../../core/services/user.types';
import { DEFAULT_PAGE_SIZE } from '../../core/config';
import { forkJoin, map } from 'rxjs';

export interface LeadsListResolved {
  leads: LeadListResponse;
  users: UserSummary[];
  serviceTypes: ServiceTypeItem[];
}

export const leadsListResolver: ResolveFn<LeadsListResolved> = () => {
  const leadsService = inject(LeadsService);
  const userService = inject(UserService);
  const serviceTypesService = inject(ServiceTypesService);

  return forkJoin({
    leads: leadsService.list({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    users: userService.listUsers(),
    serviceTypes: serviceTypesService.listActive().pipe(
      map(response => response.items ?? []),
    ),
  });
};