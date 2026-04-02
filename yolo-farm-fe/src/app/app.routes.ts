import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () =>
			import('./features/auth/login-page.component').then((m) => m.LoginPageComponent)
	},
	{
		path: 'forbidden',
		loadComponent: () =>
			import('./features/errors/forbidden-page.component').then((m) => m.ForbiddenPageComponent)
	},
	{
		path: '',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./shared/layout/main-layout.component').then((m) => m.MainLayoutComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard'
			},
			{
				path: 'dashboard',
				loadComponent: () =>
					import('./features/dashboard/dashboard-page.component').then(
						(m) => m.DashboardPageComponent
					)
			},
			{
				path: 'devices',
				loadComponent: () =>
					import('./features/devices/devices-page.component').then((m) => m.DevicesPageComponent)
			},
			{
				path: 'telemetry',
				loadComponent: () =>
					import('./features/telemetry/telemetry-page.component').then(
						(m) => m.TelemetryPageComponent
					)
			},
			{
				path: 'profile',
				loadComponent: () =>
					import('./features/profile/profile-page.component').then((m) => m.ProfilePageComponent)
			},
			{
				path: 'users',
				canActivate: [adminGuard],
				loadComponent: () =>
					import('./features/users/users-page.component').then((m) => m.UsersPageComponent)
			}
		]
	},
	{
		path: '**',
		loadComponent: () =>
			import('./features/errors/not-found-page.component').then((m) => m.NotFoundPageComponent)
	}
];
