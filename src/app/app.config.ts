import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpBackend, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ColorPickerModule } from '@iplab/ngx-color-picker';
import {
  ArrowLeft,
  ArrowLeftRight,
  Brush,
  Building,
  Calendar,
  Car,
  Check,
  Clock,
  Droplet,
  Flame,
  Hammer,
  HardHat,
  Heart,
  House,
  LayoutDashboard,
  Lightbulb,
  List,
  Lock,
  LucideAngularModule,
  Mail,
  PaintBucket,
  Phone,
  Plug,
  Plus,
  Scissors,
  Search,
  Settings,
  Shield,
  Star,
  Sun,
  Thermometer,
  Trees,
  Truck,
  User,
  Users,
  Wifi,
  Wrench,
  Zap,
  AppWindow,
  Toolbox,
} from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorReportingInterceptor } from './core/interceptors/error-reporting.interceptor';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader';

const createTranslateLoader = (handler: HttpBackend) => new MultiTranslateHttpLoader(handler, [
  { prefix: '/assets/i18n/', suffix: '/common.json' },
  { prefix: '/assets/i18n/', suffix: '/navigation.json' },
  { prefix: '/assets/i18n/', suffix: '/auth.json' },
  { prefix: '/assets/i18n/', suffix: '/data-grid.json' },
  { prefix: '/assets/i18n/', suffix: '/sidebar.json' },
  { prefix: '/assets/i18n/', suffix: '/menu.json' },
  { prefix: '/assets/i18n/', suffix: '/profile.json' },
  { prefix: '/assets/i18n/', suffix: '/leads.json' },
  { prefix: '/assets/i18n/', suffix: '/services.json' },
]);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(), // Required by ColorPickerModule until migration to native CSS animations
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorReportingInterceptor, authInterceptor])),
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpBackend],
      },
      fallbackLang: 'en',
      lang: 'nl'
    }),
    importProvidersFrom(
      ColorPickerModule,
      LucideAngularModule.pick({
        ArrowLeft,
        ArrowLeftRight,
        Brush,
        Building,
        Calendar,
        Car,
        Check,
        Clock,
        Droplet,
        Hammer,
        HardHat,
        Heart,
        House,
        LayoutDashboard,
        Lightbulb,
        List,
        Lock,
        Mail,
        PaintBucket,
        Phone,
        Plug,
        Plus,
        Scissors,
        Search,
        Settings,
        Shield,
        Star,
        Sun,
        Thermometer,
        Trees,
        Truck,
        User,
        Users,
        Wifi,
        AppWindow,
        Wrench,
        Zap,
        Flame,
        Toolbox,
      }),
    ),
  ]
};
