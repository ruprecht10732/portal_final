import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { guestGuard } from './core/guards/guest.guard';
import { adminGuard } from './core/guards/admin.guard';
import { superadminGuard } from './core/guards/superadmin.guard';
import { catalogDetailResolver } from './routes/catalog/catalog-detail/catalog-detail.resolver';
import { leadsListResolver } from './routes/leads/leads-list.resolver';
import { partnersOfferListResolver } from './routes/partners/partners-offer-list/partners-offer-list.resolver';
import { quoteIntroGuard } from './core/guards/quote-intro.guard';
import { SidebarPanelConfig } from './routes/app-shell/sidebar-panel.config';

const partnersPanelItems: SidebarPanelConfig['panelItems'] = [
	{ label: 'partners.overview', route: '/app/partners', icon: 'list', exact: true },
	{ label: 'partners.create', route: '/app/partners/new', icon: 'plus' },
	{ label: 'partners.offersOverview', route: '/app/offers', icon: 'handshake', exact: true },
	{ label: 'partners.createOffer', route: '/app/offers/new', icon: 'plus' },
];

const inboxPanelItems: SidebarPanelConfig['panelItems'] = [
	{ label: 'navigation.emailInbox', route: '/app/inbox', icon: 'mail', exact: true },
	{ label: 'navigation.whatsappInbox', route: '/app/inbox/whatsapp', icon: 'message-circle', roles: ['admin'] },
];

const settingsPanelItems: SidebarPanelConfig['panelItems'] = [
	{ group: 'sidebar.groups.channels', label: 'profile.emailAccounts', route: '/app/settings/email-accounts', icon: 'mail', exact: true },
	{ group: 'sidebar.groups.channels', label: 'organization.settings.whatsapp.title', route: '/app/settings/whatsapp', icon: 'message-circle', roles: ['admin'] },
	{ group: 'sidebar.groups.channels', label: 'organization.settings.smtp.title', route: '/app/settings/smtp', icon: 'mail', roles: ['admin'] },
	{ group: 'sidebar.groups.channels', label: 'organization.settings.workflows.title', route: '/app/settings/workflows', icon: 'settings', roles: ['admin'] },
	{ group: 'sidebar.groups.operations', label: 'appointments.availabilityNav', route: '/app/settings/availability', icon: 'clock', exact: true },
	{ group: 'sidebar.groups.operations', label: 'organization.settings.quoteDefaults', route: '/app/settings/quote-defaults', icon: 'file-text', roles: ['admin'] },
	{ group: 'sidebar.groups.operations', label: 'organization.settings.partnerOfferTerms.title', route: '/app/settings/partner-offer-terms', icon: 'file-text', roles: ['admin'] },
	{ group: 'sidebar.groups.operations', label: 'navigation.services', route: '/app/settings/services', icon: 'wrench', roles: ['admin'], exact: true },
	{ group: 'sidebar.groups.operations', label: 'navigation.catalog', route: '/app/settings/catalog', icon: 'book-open', exact: true },
	{ group: 'sidebar.groups.operations', label: 'catalog.vatRates.title', route: '/app/settings/catalog/vat-rates', icon: 'settings' },
	{ group: 'sidebar.groups.operations', label: 'productFlows.navLabel', route: '/app/settings/flows', icon: 'git-branch', roles: ['admin'], exact: true },
	{ group: 'sidebar.groups.automation', label: 'organization.settings.ai.title', route: '/app/settings/ai', icon: 'brain-circuit', roles: ['admin'] },
	{ group: 'sidebar.groups.company', label: 'organization.overview', route: '/app/settings/company', icon: 'building', exact: true, roles: ['admin'] },
	{ group: 'sidebar.groups.company', label: 'organization.team.navLabel', route: '/app/settings/team', icon: 'users', roles: ['admin'] },
	{ group: 'sidebar.groups.integrations', label: 'organization.integrations.moneybird.navLabel', route: '/app/settings/moneybird', icon: 'settings', exact: true, roles: ['admin'] },
	{ group: 'sidebar.groups.integrations', label: 'webhook.navLabel', route: '/app/settings/webhooks', icon: 'webhook', exact: true, roles: ['admin'] },
	{ group: 'sidebar.groups.integrations', label: 'webhook.googleLeads.navLabel', route: '/app/settings/google-leads', icon: 'globe', roles: ['admin'] },
	{ group: 'sidebar.groups.integrations', label: 'googleAds.navLabel', route: '/app/settings/google-ads-export', icon: 'download', roles: ['admin'] },
];

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
					{
						path: 'email-accounts',
						redirectTo: '/app/settings/email-accounts',
						pathMatch: 'full',
					},
				],
			},
			{
				path: 'settings',
				loadComponent: () => import('./routes/organization/organization-layout/organization-layout.component').then(m => m.OrganizationLayoutComponent),
				data: {
					panelItems: settingsPanelItems,
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						pathMatch: 'full',
						redirectTo: 'email-accounts',
					},
					{
						path: 'email-accounts',
						loadComponent: () => import('./routes/profile/email-accounts/email-accounts.component').then(m => m.EmailAccountsComponent),
					},
					{
						path: 'company',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/organization-overview/organization-overview.component').then(m => m.OrganizationOverviewComponent),
					},
					{
						path: 'team',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/organization-invites/organization-invites.component').then(m => m.OrganizationInvitesComponent),
					},
					{
						path: 'team/new',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-invite-create/organization-invite-create.component').then(
								m => m.OrganizationInviteCreateComponent,
							),
					},
					{
						path: 'team/:inviteId/edit',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-invite-edit/organization-invite-edit.component').then(
								m => m.OrganizationInviteEditComponent,
							),
					},
					{
						path: 'quote-defaults',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/quote-defaults/organization-quote-defaults-settings.component').then(
								m => m.OrganizationQuoteDefaultsSettingsComponent,
							),
					},
					{
						path: 'partner-offer-terms',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/partner-offer-terms/organization-partner-offer-terms-settings.component').then(
								m => m.OrganizationPartnerOfferTermsSettingsComponent,
							),
					},
					{
						path: 'ai',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/ai/organization-ai-settings.component').then(
								m => m.OrganizationAiSettingsComponent,
							),
					},
					{
						path: 'whatsapp',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/whatsapp/organization-whatsapp-settings.component').then(
								m => m.OrganizationWhatsAppSettingsComponent,
							),
					},
					{
						path: 'smtp',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/smtp/organization-smtp-settings.component').then(
								m => m.OrganizationSmtpSettingsComponent,
							),
					},
					{
						path: 'workflows',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/organization-settings/workflows/organization-workflows-settings.component').then(
								m => m.OrganizationWorkflowsSettingsComponent,
							),
					},
					{
						path: 'availability',
						loadComponent: () => import('./routes/appointments/availability-settings/availability-settings.component').then(m => m.AvailabilitySettingsComponent),
					},
					{
						path: 'catalog',
						loadComponent: () => import('./routes/catalog/catalog-list/catalog-list.component').then(m => m.CatalogListComponent),
					},
					{
						path: 'catalog/new',
						loadComponent: () => import('./routes/catalog/catalog-create/catalog-create.component').then(m => m.CatalogCreateComponent),
					},
					{
						path: 'catalog/vat-rates',
						loadComponent: () => import('./routes/catalog/vat-rates/vat-rates-list/vat-rates-list.component').then(m => m.VatRatesListComponent),
					},
					{
						path: 'catalog/:id',
						loadComponent: () => import('./routes/catalog/catalog-detail/catalog-detail.component').then(m => m.CatalogDetailComponent),
						resolve: { resolved: catalogDetailResolver },
					},
					{
						path: 'catalog/:id/edit',
						loadComponent: () => import('./routes/catalog/catalog-edit/catalog-edit.component').then(m => m.CatalogEditComponent),
					},
					{
						path: 'services',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/services/service-types/service-types.component').then(m => m.ServiceTypesComponent),
					},
					{
						path: 'services/new',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/services/service-types/service-type-create.component').then(m => m.ServiceTypeCreateComponent),
					},
					{
						path: 'services/:id',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/services/service-type-detail/service-type-detail.component').then(m => m.ServiceTypeDetailComponent),
					},
					{
						path: 'flows',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/product-flows/product-flows.component').then(m => m.ProductFlowsComponent),
					},
					{
						path: 'flows/new',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/product-flow-editor/product-flow-editor.component').then(m => m.ProductFlowEditorComponent),
					},
					{
						path: 'flows/:id/edit',
						canActivate: [adminGuard],
						loadComponent: () =>
							import('./routes/organization/product-flow-editor/product-flow-editor.component').then(m => m.ProductFlowEditorComponent),
					},
					{
						path: 'moneybird',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/moneybird-integration/moneybird-integration.component').then(m => m.MoneybirdIntegrationComponent),
					},
					{
						path: 'webhooks',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/webhook-keys/webhook-keys.component').then(m => m.WebhookKeysComponent),
					},
					{
						path: 'google-leads',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/google-lead-webhooks/google-lead-webhooks.component').then(m => m.GoogleLeadWebhooksComponent),
					},
					{
						path: 'google-ads-export',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/organization/google-ads-export/google-ads-export.component').then(m => m.GoogleAdsExportComponent),
					},
				],
			},
			{
				path: 'organization',
				canActivate: [adminGuard],
				children: [
					{ path: '', pathMatch: 'full', redirectTo: '/app/settings/company' },
					{ path: 'settings', pathMatch: 'full', redirectTo: '/app/settings' },
					{ path: 'settings/quote-defaults', redirectTo: '/app/settings/quote-defaults' },
					{ path: 'settings/partner-offer-terms', redirectTo: '/app/settings/partner-offer-terms' },
					{ path: 'settings/ai', redirectTo: '/app/settings/ai' },
					{ path: 'settings/whatsapp', redirectTo: '/app/settings/whatsapp' },
					{ path: 'settings/smtp', redirectTo: '/app/settings/smtp' },
					{ path: 'settings/workflows', redirectTo: '/app/settings/workflows' },
					{ path: 'team', pathMatch: 'full', redirectTo: '/app/settings/team' },
					{ path: 'team/new', redirectTo: '/app/settings/team/new' },
					{ path: 'team/:inviteId/edit', redirectTo: '/app/settings/team/:inviteId/edit' },
					{ path: 'integrations', pathMatch: 'full', redirectTo: '/app/settings/moneybird' },
					{ path: 'integrations/moneybird', redirectTo: '/app/settings/moneybird' },
					{ path: 'integrations/webhooks', redirectTo: '/app/settings/webhooks' },
					{ path: 'integrations/google-leads', redirectTo: '/app/settings/google-leads' },
					{ path: 'integrations/google-ads-export', redirectTo: '/app/settings/google-ads-export' },
				],
					},
			{
				path: 'inbox',
				data: {
					panelItems: inboxPanelItems,
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						pathMatch: 'full',
						loadComponent: () => import('./routes/inbox/inbox.component').then(m => m.InboxComponent),
					},
					{
						path: 'whatsapp',
						canActivate: [adminGuard],
						loadComponent: () => import('./routes/whatsapp/whatsapp-inbox.component').then(m => m.WhatsAppInboxComponent),
					},
					{
						path: 'settings',
						redirectTo: '/app/settings/email-accounts',
						pathMatch: 'full',
					},
					{
						path: 'email-accounts',
						redirectTo: '/app/settings/email-accounts',
						pathMatch: 'full',
					},
				],
			},
			{
				path: 'whatsapp',
				children: [
					{
						path: '',
						pathMatch: 'full',
						redirectTo: '/app/inbox/whatsapp',
					},
					{
						path: 'settings',
						redirectTo: '/app/settings/whatsapp',
						pathMatch: 'full',
					},
					{
						path: 'inbox',
						redirectTo: '/app/inbox/whatsapp',
						pathMatch: 'full',
					},
				],
			},
			{
				path: 'agent-whatsapp',
				canActivate: [superadminGuard],
				loadComponent: () => import('./routes/whatsapp-agent/whatsapp-agent-admin.component').then(m => m.WhatsAppAgentAdminComponent),
			},
			{
				path: 'tasks',
				loadComponent: () => import('./routes/tasks/tasks-page.component').then(m => m.TasksPageComponent),
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
					panelItems: partnersPanelItems,
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
						redirectTo: '/app/offers',
						pathMatch: 'full',
					},
					{
						path: 'offers/new',
						redirectTo: '/app/offers/new',
						pathMatch: 'full',
					},
					{
						path: 'offers/:offerId/preview',
						redirectTo: '/app/offers/:offerId/preview',
					},
					{
						path: ':id',
						loadComponent: () => import('./routes/partners/partners-detail/partners-detail.component').then(m => m.PartnersDetailComponent),
					},
					{
						path: ':id/edit',
						loadComponent: () => import('./routes/partners/partners-edit/partners-edit.component').then(m => m.PartnersEditComponent),
					},
				],
			},
			{
				path: 'offers',
				loadComponent: () =>
					import('./routes/partners/partners-offers-layout/partners-offers-layout.component').then(
						m => m.PartnersOffersLayoutComponent,
					),
				data: {
					panelItems: partnersPanelItems,
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: 'new',
						loadComponent: () =>
							import('./routes/partners/partners-offer-create/partners-offer-create.component').then(
								m => m.PartnersOfferCreateComponent,
							),
					},
					{
						path: ':offerId/preview',
						loadComponent: () => import('./routes/partners/partner-offer/partner-offer.component').then(m => m.PartnerOfferComponent),
						data: { preview: true },
					},
					{
						path: ':offerId/detail',
						loadComponent: () =>
							import('./routes/partners/partners-offer-detail/partners-offer-detail.component').then(
								m => m.PartnersOfferDetailComponent,
							),
					},
					{
						path: '',
						loadComponent: () =>
							import('./routes/partners/partners-offer-list/partners-offer-list.component').then(
								m => m.PartnersOfferListComponent,
							),
						resolve: { resolved: partnersOfferListResolver },
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
						path: 'pricing-intelligence',
						loadComponent: () =>
							import('./routes/offertes/offertes-pricing-intelligence/offertes-pricing-intelligence.component').then(
								m => m.OffertesPricingIntelligenceComponent,
							),
						canActivate: [adminGuard],
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
				children: [
					{ path: '', pathMatch: 'full', redirectTo: '/app/settings/catalog' },
					{ path: 'new', redirectTo: '/app/settings/catalog/new' },
					{ path: 'vat-rates', redirectTo: '/app/settings/catalog/vat-rates' },
					{ path: ':id', redirectTo: '/app/settings/catalog/:id' },
					{ path: ':id/edit', redirectTo: '/app/settings/catalog/:id/edit' },
				],
			},
			{
				path: 'services',
				canActivate: [adminGuard],
				children: [
					{ path: '', pathMatch: 'full', redirectTo: '/app/settings/services' },
					{ path: 'new', redirectTo: '/app/settings/services/new' },
					{ path: ':id', redirectTo: '/app/settings/services/:id' },
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
						redirectTo: '/app/settings/availability',
						pathMatch: 'full',
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
