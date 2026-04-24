import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { filterPanelItemsForCurrentUser, isRouteActive, isRouteExact, resolvePanelItems } from './panel-utils';

@Component({
  selector: 'app-mobile-section-tabs',
  imports: [RouterLink, LucideAngularModule, TranslatePipe],
  styles: `
    :host { display: contents; }
    .section-tabs { scrollbar-width: none; -ms-overflow-style: none; }
    .section-tabs::-webkit-scrollbar { display: none; }
  `,
  template: `
    @if (showTabs()) {
      <div
        class="sticky top-0 z-30 border-b border-zinc-200 bg-white lg:hidden"
        [attr.aria-label]="'sidebar.quickLinks' | translate"
      >
        <div class="section-tabs flex gap-1 overflow-x-auto px-3 py-2">
          @for (item of panelItems(); track item.route) {
            <a
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              [class]="(item.exact ? isExactActive(item.route) : isActive(item.route))
                ? 'border-black bg-black text-white'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 active:bg-zinc-100'"
              [routerLink]="item.route"
              [attr.aria-label]="item.label | translate"
            >
              @if (item.icon) {
                <lucide-icon [name]="item.icon" class="h-3.5 w-3.5"></lucide-icon>
              }
              {{ item.label | translate }}
            </a>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSectionTabsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);

  private readonly user = toSignal(
    this.userService.getProfile().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly rawPanelItems = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => resolvePanelItems(this.route)),
    ),
    { initialValue: resolvePanelItems(this.route) },
  );

  protected readonly panelItems = computed(() =>
    filterPanelItemsForCurrentUser(this.rawPanelItems(), this.user()?.roles ?? []),
  );

  protected readonly showTabs = computed(() => this.panelItems().length > 1);

  protected isActive(route: string): boolean {
    return isRouteActive(this.currentUrl(), route);
  }

  protected isExactActive(route: string): boolean {
    return isRouteExact(this.currentUrl(), route);
  }
}
