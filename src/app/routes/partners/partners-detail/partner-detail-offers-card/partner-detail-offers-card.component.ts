import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PartnersService } from '../../../../core/services/partners.service';
import type { OfferResponse } from '../../../../core/services/partners.types';

@Component({
  selector: 'app-partner-detail-offers-card',
  templateUrl: './partner-detail-offers-card.component.html',
  styleUrl: './partner-detail-offers-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent],
})
export class PartnerDetailOffersCardComponent {
  private readonly router = inject(Router);
  private readonly partnersService = inject(PartnersService);

  readonly offers = input<OfferResponse[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly partnerPhone = input('');
  readonly partnerName = input('');

  readonly refresh = output<void>();

  protected readonly sortedOffers = computed(() => {
    return [...this.offers()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'partners.offer.status.pending',
      sent: 'partners.offer.status.sent',
      accepted: 'partners.offer.status.accepted',
      rejected: 'partners.offer.status.rejected',
      expired: 'partners.offer.status.expired',
    };
    return labels[status] ?? status;
  }

  protected statusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      sent: 'status-sent',
      accepted: 'status-accepted',
      rejected: 'status-rejected',
      expired: 'status-expired',
    };
    return classes[status] ?? '';
  }

  protected centsToEuros(cents: number): string {
    return (cents / 100).toLocaleString('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected previewOffer(offer: OfferResponse): void {
	this.router.navigate(['/app/offers', offer.id, 'preview']);
  }

  protected openWhatsApp(offer: OfferResponse): void {
    const phone = this.partnerPhone();
    const name = this.partnerName();
    if (!phone) return;
    const url = this.partnersService.buildOfferWhatsAppUrl(
      phone,
      name,
      offer.publicToken,
      offer.vakmanPriceCents,
    );
    globalThis.open(url, '_blank', 'noopener');
  }

  protected isActionable(offer: OfferResponse): boolean {
    return offer.status === 'pending' || offer.status === 'sent';
  }
}
