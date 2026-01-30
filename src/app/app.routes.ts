import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { adminGuard } from './core/guards/admin.guard';
import { leadsListResolver } from './routes/leads/leads-list.resolver';
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
		path: 'app',
		loadComponent: () => import('./routes/app-shell/authenticated-layout.component').then(m => m.AuthenticatedLayoutComponent),
		canActivate: [authGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard',
			},
			{
				path: 'dashboard',
				loadComponent: () => import('./routes/dashboard/dashboard.component').then(m => m.DashboardComponent),
			},
			{
				path: 'profile',
				loadComponent: () => import('./routes/profile/profile-layout.component').then(m => m.ProfileLayoutComponent),
				data: {
					panelItems: [
						{ label: 'Personal Details', route: '/app/profile/details', icon: 'user', exact: true },
						{ label: 'Security', route: '/app/profile/security', icon: 'lock' },
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
				path: 'leads',
				loadComponent: () => import('./routes/leads/leads-layout/leads-layout.component').then(m => m.LeadsLayoutComponent),
				data: {
					panelItems: [
						{ label: 'Lead overview', route: '/app/leads', icon: 'list', exact: true },
						{ label: 'Create lead', route: '/app/leads/new', icon: 'plus' },
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
				path: 'services',
				loadComponent: () => import('./routes/services/services-layout/services-layout.component').then(m => m.ServicesLayoutComponent),
				canActivate: [adminGuard],
				data: {
					panelItems: [
						{ label: 'Service types', route: '/app/services', icon: 'list', exact: true },
						{ label: 'Create service type', route: '/app/services/new', icon: 'plus' },
					],
				} satisfies SidebarPanelConfig,
				children: [
					{
						path: '',
						loadComponent: () => import('./routes/services/service-types/service-types.component').then(m => m.ServiceTypesComponent),
						data: { mode: 'list' },
					},
					{
						path: 'new',
						loadComponent: () => import('./routes/services/service-types/service-types.component').then(m => m.ServiceTypesComponent),
						data: { mode: 'create' },
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
