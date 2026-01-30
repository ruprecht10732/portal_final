import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  ArrowLeftRight,
  LayoutDashboard,
  List,
  Lock,
  LucideAngularModule,
  Plus,
  User,
  Users,
  Wrench,
} from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorReportingInterceptor } from './core/interceptors/error-reporting.interceptor';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorReportingInterceptor, authInterceptor])),
    importProvidersFrom(
      LucideAngularModule.pick({
        LayoutDashboard,
        Users,
        ArrowLeftRight,
        User,
        List,
        Plus,
        Lock,
        Wrench,
      }),
    ),
  ]
};
