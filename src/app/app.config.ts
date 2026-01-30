import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ColorPickerModule } from '@iplab/ngx-color-picker';
import {
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(), // Required by ColorPickerModule until migration to native CSS animations
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorReportingInterceptor, authInterceptor])),
    importProvidersFrom(
      ColorPickerModule,
      LucideAngularModule.pick({
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
