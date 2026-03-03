import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { DEFAULT_PAGE_SIZE } from '../../../core/config';
import { PartnersService } from '../../../core/services/partners.service';
import type { OfferListResponse, Partner } from '../../../core/services/partners.types';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';

export interface PartnersOfferListResolved {
  offers: OfferListResponse;
  partners: Partner[];
  serviceTypes: ServiceTypeItem[];
}

export const partnersOfferListResolver: ResolveFn<PartnersOfferListResolved> = () => {
  const partnersService = inject(PartnersService);
  const serviceTypesService = inject(ServiceTypesService);

  return forkJoin({
    offers: partnersService.listOffers({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    partners: partnersService
      .list({
        page: 1,
        pageSize: 100,
        sortBy: 'businessName',
        sortOrder: 'asc',
      })
      .pipe(map(response => response.items ?? [])),
    serviceTypes: serviceTypesService.listActive().pipe(map(response => response.items ?? [])),
  });
};
