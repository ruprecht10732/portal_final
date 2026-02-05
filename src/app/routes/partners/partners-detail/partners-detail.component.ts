import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PartnersService } from '../../../core/services/partners.service';
import type { Partner } from '../../../core/services/partners.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-partners-detail',
  templateUrl: './partners-detail.component.html',
  styleUrl: './partners-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonComponent, CardComponent, PageHeaderComponent],
})
export class PartnersDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);

  protected readonly partner = signal<Partner | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }
    this.loadPartner(id);
  }

  protected goBack(): void {
    this.router.navigate(['/app/partners']);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private loadPartner(id: string): void {
    this.loading.set(true);
    this.partnersService.getById(id).subscribe({
      next: partner => {
        this.partner.set(partner);
        this.loading.set(false);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }
}
