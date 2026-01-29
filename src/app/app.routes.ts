import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { leadsListResolver } from './routes/leads/leads-list.resolver';

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
				loadComponent: () => import('./routes/profile/profile.component').then(m => m.ProfileComponent),
			},
			{
				path: 'leads',
				loadComponent: () => import('./routes/leads/lead-list/lead-list.component').then(m => m.LeadListComponent),
				resolve: { leads: leadsListResolver },
			},
			{
				path: 'leads/new',
				loadComponent: () => import('./routes/leads/lead-form/lead-form.component').then(m => m.LeadFormComponent),
			},
			{
				path: 'leads/:id',
				loadComponent: () => import('./routes/leads/lead-detail/lead-detail.component').then(m => m.LeadDetailComponent),
			},
			{
				path: 'leads/:id/edit',
				loadComponent: () => import('./routes/leads/lead-form/lead-form.component').then(m => m.LeadFormComponent),
			},
		],
	},
	{
		path: '**',
		redirectTo: 'sign-in',
	},
];
