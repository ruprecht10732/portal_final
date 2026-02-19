import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { guestGuard } from './core/guards/guest.guard';
import { adminGuard } from './core/guards/admin.guard';
import { catalogDetailResolver } from './routes/catalog/catalog-detail/catalog-detail.resolver';
import { leadsListResolver } from './routes/leads/leads-list.resolver';
import { partnersOfferListResolver } from './routes/partners/partners-offer-list/partners-offer-list.resolver';
import { quoteIntroGuard } from './core/guards/quote-intro.guard';
import { SidebarPanelConfig } from './routes/app-shell/sidebar-panel.config';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'sign-in',
	},
	{
		path: 'sign-in',
		loadComponent: () => import('./routes/auth/sign-in/sign-in.component').then(m => m.SignInComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'sign-up',
		loadComponent: () => import('./routes/auth/sign-up/sign-up.component').then(m => m.SignUpComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'forgot-password',
		loadComponent: () => import('./routes/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'reset-password',
		loadComponent: () => import('./routes/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'check-email',
		loadComponent: () => import('./routes/auth/check-email/check-email.component').then(m => m.CheckEmailComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'verify-email',
		loadComponent: () => import('./routes/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
		canActivate: [guestGuard],
	},
	{
		path: 'onboarding',
		loadComponent: () => import('./routes/onboarding/onboarding.component').then(m => m.OnboardingComponent),
		canActivate: [authGuard],
	},
	{
		path: 'quote/:token/intro',
		loadComponent: () => import('./routes/offertes/quote-proposal/quote-intro-page.component').then(m => m.QuoteIntroPageComponent),
	},
	{
		path: 'quote/:token',
		loadComponent: () => import('./routes/offertes/quote-proposal/quote-proposal.component').then(m => m.QuoteProposalComponent),
		canActivate: [quoteIntroGuard],
	},
	{
		path: 'partner-offer/:token',
		loadComponent: () => import('./routes/partners/partner-offer/partner-offer.component').then(m => m.PartnerOfferComponent),
	},
	{
		path: 'track/:token',
		loadComponent: () => import('./routes/track/lead-track.component').then(m => m.LeadTrackComponent),
	},
	{
		path: 'app',
		loadComponent: () => import('./routes/app-shell/authenticated-layout.component').then(m => m.AuthenticatedLayoutComponent),
		canActivate: [authGuard],
		canActivateChild: [onboardingGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard',
			},
			{
				path: 'dashboard',
				data: {
					panelItems: [
						{ label: 'dashboard.views.overview', route: '/app/dashboard/overview', icon: 'list', exact: true },
						{ label: 'dashboard.views.leadsByStatus', route: '/app/dashboard/leads-status', icon: 'users' },
						{ label: 'dashboard.views.leadsByPipeline', route: '/app/dashboard/leads-pipeline', icon: 'activity' },
						{ label: 'dashboard.views.quotes', route: '/app/dashboard/quotes', icon: 'file-text' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						pathMatch: 'full',
						redirectTo: 'overview',
					},
					{
						path: 'overview',
						loadComponent: () => import('./routes/dashboard/dashboard.component').then(m => m.DashboardComponent),
					},
					{
						path: 'leads-status',
						loadComponent: () => import('./routes/dashboard/leads-status-board/leads-status-board.component').then(m => m.LeadsStatusBoardComponent),
					},
					{
						path: 'leads-pipeline',
						loadComponent: () =>
							import('./routes/dashboard/leads-pipeline-board/leads-pipeline-board.component').then(m => m.LeadsPipelineBoardComponent),
					},
					{
						path: 'quotes',
						loadComponent: () => import('./routes/dashboard/quotes-board/quotes-board.component').then(m => m.QuotesBoardComponent),
					},
				],
			},
			{
				path: 'profile',
				loadComponent: () => import('./routes/profile/profile-layout.component').then(m => m.ProfileLayoutComponent),
				data: {
					panelItems: [
						{ label: 'profile.personalDetails', route: '/app/profile/details', icon: 'user', exact: true },
						{ label: 'profile.security', route: '/app/profile/security', icon: 'lock' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						pathMatch: 'full',
						redirectTo: 'details',
					},
					{
						path: 'details',
						loadComponent: () => import('./routes/profile/personal-details/personal-details.component').then(m => m.PersonalDetailsComponent),
					},
					{
						path: 'security',
						loadComponent: () => import('./routes/profile/security/security.component').then(m => m.SecurityComponent),
					},
				],
			},
			{
				path: 'organization',
				loadComponent: () => import('./routes/organization/organization-layout/organization-layout.component').then(m => m.OrganizationLayoutComponent),
				canActivate: [adminGuard],
				data: {
					panelItems: [
						{ label: 'organization.overview', route: '/app/organization', icon: 'building', exact: true },
						{ label: 'organization.settings.navLabel', route: '/app/organization/settings', icon: 'settings' },
						{ label: 'organization.team.navLabel', route: '/app/organization/team', icon: 'mail' },
						{ label: 'organization.integrations.navLabel', route: '/app/organization/integrations', icon: 'webhook' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/organization/organization-overview/organization-overview.component').then(m => m.OrganizationOverviewComponent),
					},
					{
						path: 'settings',
						loadComponent: () =>
							import('./routes/organization/organization-settings-layout/organization-settings-layout.component').then(
								m => m.OrganizationSettingsLayoutComponent,
							),
						data: {
							panelItems: [
								{ label: 'organization.backToOrg', route: '/app/organization', icon: 'building', exact: true },
								{ label: 'organization.settings.quoteDefaults', route: '/app/organization/settings/quote-defaults', icon: 'settings', exact: true },
								{ label: 'organization.settings.whatsapp.title', route: '/app/organization/settings/whatsapp', icon: 'globe' },
								{ label: 'organization.settings.smtp.title', route: '/app/organization/settings/smtp', icon: 'mail' },
								{ label: 'organization.settings.workflows.title', route: '/app/organization/settings/workflows', icon: 'settings' },
							],
						} satisfies SidebarPanelConfig,
						children: [
							{
								path: '',
								pathMatch: 'full',
								redirectTo: 'quote-defaults',
							},
							{
								path: 'quote-defaults',
								loadComponent: () =>
									import(
										'./routes/organization/organization-settings/quote-defaults/organization-quote-defaults-settings.component'
									).then(m => m.OrganizationQuoteDefaultsSettingsComponent),
							},
							{
								path: 'whatsapp',
								loadComponent: () =>
									import('./routes/organization/organization-settings/whatsapp/organization-whatsapp-settings.component').then(
										m => m.OrganizationWhatsAppSettingsComponent,
									),
							},
							{
								path: 'smtp',
								loadComponent: () =>
									import('./routes/organization/organization-settings/smtp/organization-smtp-settings.component').then(
										m => m.OrganizationSmtpSettingsComponent,
									),
							},
							{
								path: 'workflows',
								loadComponent: () =>
									import('./routes/organization/organization-settings/workflows/organization-workflows-settings.component').then(
										m => m.OrganizationWorkflowsSettingsComponent,
									),
							},
						],
					},
					{
						path: 'team',
						loadComponent: () => import('./routes/organization/organization-team-layout/organization-team-layout.component').then(m => m.OrganizationTeamLayoutComponent),
						data: {
							panelItems: [
								{ label: 'organization.backToOrg', route: '/app/organization', icon: 'building', exact: true },
								{ label: 'organization.invites', route: '/app/organization/team', icon: 'mail', exact: true },
								{ label: 'organization.newInvite', route: '/app/organization/team/new', icon: 'plus' },
							],
						} satisfies SidebarPanelConfig,
						children: [
							{
								path: '',
								loadComponent: () =>
									import('./routes/organization/organization-invites/organization-invites.component').then(m => m.OrganizationInvitesComponent),
							},
							{
								path: 'new',
								loadComponent: () =>
									import('./routes/organization/organization-invite-create/organization-invite-create.component').then(
										m => m.OrganizationInviteCreateComponent,
									),
							},
							{
								path: ':inviteId/edit',
								loadComponent: () =>
									import('./routes/organization/organization-invite-edit/organization-invite-edit.component').then(
										m => m.OrganizationInviteEditComponent,
									),
							},
						],
					},
					{
						path: 'integrations',
						loadComponent: () =>
							import('./routes/organization/organization-integrations-layout/organization-integrations-layout.component').then(
								m => m.OrganizationIntegrationsLayoutComponent,
							),
						data: {
							panelItems: [
								{ label: 'organization.backToOrg', route: '/app/organization', icon: 'building', exact: true },
								{ label: 'organization.integrations.moneybird.navLabel', route: '/app/organization/integrations/moneybird', icon: 'settings', exact: true },
								{ label: 'webhook.navLabel', route: '/app/organization/integrations/webhooks', icon: 'webhook', exact: true },
								{ label: 'webhook.googleLeads.navLabel', route: '/app/organization/integrations/google-leads', icon: 'globe' },
								{ label: 'googleAds.navLabel', route: '/app/organization/integrations/google-ads-export', icon: 'download' },
							],
						} satisfies SidebarPanelConfig,
						children: [
							{
								path: '',
								pathMatch: 'full',
								redirectTo: 'moneybird',
							},
							{
								path: 'moneybird',
								loadComponent: () =>
									import('./routes/organization/moneybird-integration/moneybird-integration.component').then(
										m => m.MoneybirdIntegrationComponent,
									),
							},
							{
								path: 'webhooks',
								loadComponent: () => import('./routes/organization/webhook-keys/webhook-keys.component').then(m => m.WebhookKeysComponent),
							},
							{
								path: 'google-leads',
								loadComponent: () =>
									import('./routes/organization/google-lead-webhooks/google-lead-webhooks.component').then(
										m => m.GoogleLeadWebhooksComponent,
									),
							},
							{
								path: 'google-ads-export',
								loadComponent: () =>
									import('./routes/organization/google-ads-export/google-ads-export.component').then(m => m.GoogleAdsExportComponent),
							},
						],
					},
				],
			},
			{
				path: 'leads',
				loadComponent: () => import('./routes/leads/leads-layout/leads-layout.component').then(m => m.LeadsLayoutComponent),
				data: {
					panelItems: [
						{ label: 'leads.overview', route: '/app/leads', icon: 'list', exact: true },
						{ label: 'leads.create', route: '/app/leads/new', icon: 'plus' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/leads/lead-list/lead-list.component').then(m => m.LeadListComponent),
						resolve: { leads: leadsListResolver },
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/leads/lead-form/lead-form.component').then(m => m.LeadFormComponent),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/leads/lead-detail/lead-detail.component').then(m => m.LeadDetailComponent),
					},
					{
						path: ':id/edit',
						loadComponent: () => import('./routes/leads/lead-form/lead-form.component').then(m => m.LeadFormComponent),
					},
				],
			},
			{
				path: 'partners',
				loadComponent: () => import('./routes/partners/partners-layout/partners-layout.component').then(m => m.PartnersLayoutComponent),
				data: {
					panelItems: [
						{ label: 'partners.overview', route: '/app/partners', icon: 'list', exact: true },
						{ label: 'partners.offersOverview', route: '/app/partners/offers', icon: 'briefcase' },
						{ label: 'partners.createOffer', route: '/app/partners/offers/new', icon: 'handshake' },
						{ label: 'partners.create', route: '/app/partners/new', icon: 'plus' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/partners/partners-list/partners-list.component').then(m => m.PartnersListComponent),
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/partners/partners-create/partners-create.component').then(m => m.PartnersCreateComponent),
					},
					{
						path: 'offers',
						loadComponent: () =>
							import('./routes/partners/partners-offer-list/partners-offer-list.component').then(
								m => m.PartnersOfferListComponent,
							),
						resolve: { resolved: partnersOfferListResolver },
					},
					{
						path: 'offers/new',
						loadComponent: () =>
							import('./routes/partners/partners-offer-create/partners-offer-create.component').then(
								m => m.PartnersOfferCreateComponent,
							),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/partners/partners-detail/partners-detail.component').then(m => m.PartnersDetailComponent),
					},
					{
						path: ':id/edit',
						loadComponent: () => import('./routes/partners/partners-edit/partners-edit.component').then(m => m.PartnersEditComponent),
					},
					{
						path: 'offers/:offerId/preview',
						loadComponent: () => import('./routes/partners/partner-offer/partner-offer.component').then(m => m.PartnerOfferComponent),
						data: { preview: true },
					},
				],
			},
			{
				path: 'offertes',
				loadComponent: () => import('./routes/offertes/offertes-layout/offertes-layout.component').then(m => m.OffertesLayoutComponent),
				data: {
					panelItems: [
						{ label: 'offertes.overview', route: '/app/offertes', icon: 'list', exact: true },
						{ label: 'offertes.create', route: '/app/offertes/new', icon: 'plus' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/offertes/offertes-list/offertes-list.component').then(m => m.OffertesListComponent),
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/offertes/offertes-create/offertes-create.component').then(m => m.OffertesCreateComponent),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/offertes/offertes-detail/offertes-detail.component').then(m => m.OffertesDetailComponent),
					},
					{
						path: ':id/partner-offer',
						loadComponent: () =>
							import('./routes/offertes/offertes-partner-offer/offertes-partner-offer.component').then(
								m => m.OffertesPartnerOfferComponent,
							),
					},
					{
						path: ':id/edit',
						loadComponent: () => import('./routes/offertes/offertes-create/offertes-create.component').then(m => m.OffertesCreateComponent),
					},
				],
			},
			{
				path: 'catalog',
				loadComponent: () => import('./routes/catalog/catalog-layout/catalog-layout.component').then(m => m.CatalogLayoutComponent),
				data: {
					panelItems: [
						{ label: 'catalog.overview', route: '/app/catalog', icon: 'list', exact: true },
						{ label: 'catalog.create', route: '/app/catalog/new', icon: 'plus' },
						{ label: 'catalog.vatRates.title', route: '/app/catalog/vat-rates', icon: 'settings' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/catalog/catalog-list/catalog-list.component').then(m => m.CatalogListComponent),
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/catalog/catalog-create/catalog-create.component').then(m => m.CatalogCreateComponent),
					},
					{
						path: 'vat-rates',
						loadComponent: () => import('./routes/catalog/vat-rates/vat-rates-list/vat-rates-list.component').then(m => m.VatRatesListComponent),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/catalog/catalog-detail/catalog-detail.component').then(m => m.CatalogDetailComponent),
						resolve: { resolved: catalogDetailResolver },
					},
					{
						path: ':id/edit',
						loadComponent: () => import('./routes/catalog/catalog-edit/catalog-edit.component').then(m => m.CatalogEditComponent),
					},
				],
			},
			{
				path: 'services',
				loadComponent: () => import('./routes/services/services-layout/services-layout.component').then(m => m.ServicesLayoutComponent),
				canActivate: [adminGuard],
				data: {
					panelItems: [
						{ label: 'services.types', route: '/app/services', icon: 'list', exact: true },
						{ label: 'services.createType', route: '/app/services/new', icon: 'plus' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/services/service-types/service-types.component').then(m => m.ServiceTypesComponent),
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/services/service-types/service-type-create.component').then(m => m.ServiceTypeCreateComponent),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/services/service-type-detail/service-type-detail.component').then(m => m.ServiceTypeDetailComponent),
					},
				],
			},
			{
				path: 'search',
				loadComponent: () => import('./routes/search/search.component').then(m => m.SearchComponent),
			},
			{
				path: 'appointments',
				loadComponent: () => import('./routes/appointments/appointments-layout/appointments-layout.component').then(m => m.AppointmentsLayoutComponent),
				data: {
					panelItems: [
						{ label: 'appointments.calendar', route: '/app/appointments', icon: 'calendar', exact: true },
						{ label: 'appointments.listView', route: '/app/appointments/list', icon: 'list' },
						{ label: 'appointments.availabilityNav', route: '/app/appointments/availability', icon: 'clock' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/appointments/appointments-calendar/appointments-calendar.component').then(m => m.AppointmentsCalendarComponent),
					},
					{
						path: 'list',
						loadComponent: () => import('./routes/appointments/appointments-list/appointments-list.component').then(m => m.AppointmentsListComponent),
					},
					{
						path: 'availability',
						loadComponent: () => import('./routes/appointments/availability-settings/availability-settings.component').then(m => m.AvailabilitySettingsComponent),
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/appointments/appointment-form/appointment-form.component').then(m => m.AppointmentFormComponent),
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/appointments/appointment-detail/appointment-detail.component').then(m => m.AppointmentDetailComponent),
					},
				],
			},
		],
	},
	{
		path: '**',
		redirectTo: 'sign-in',
	},
];
