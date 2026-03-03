import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicQuoteService } from '../../../core/services/public-quote.service';
import { QuoteProposalIntroComponent } from './quote-proposal-intro.component';

@Component({
  selector: 'app-quote-intro-page',
  templateUrl: './quote-intro-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuoteProposalIntroComponent],
})
export class QuoteIntroPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicQuoteService = inject(PublicQuoteService);

  protected readonly loading = signal(true);
  protected readonly customerName = signal<string | null>(null);
  protected readonly organizationName = signal<string | null>(null);

  protected readonly customerInitial = computed(() => {
    const name = this.customerName()?.trim();
    return name ? name.charAt(0).toUpperCase() : 'G';
  });

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.router.navigate(['/']);
      return;
    }

    this.publicQuoteService.getByToken(this.token).subscribe({
      next: quote => {
        this.customerName.set(quote.customerName);
        this.organizationName.set(quote.organizationName);
        this.loading.set(false);
      },
      error: () => {
        // If quote can't load, skip intro and go straight to the proposal
        // where the error will be shown properly.
        this.markSeenAndNavigate();
      },
    });
  }

  protected continueToQuote(): void {
    this.markSeenAndNavigate();
  }

  private markSeenAndNavigate(): void {
    try {
      localStorage.setItem(`quote_intro_seen_${this.token}`, '1');
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
    this.router.navigate(['/quote', this.token]);
  }
}
