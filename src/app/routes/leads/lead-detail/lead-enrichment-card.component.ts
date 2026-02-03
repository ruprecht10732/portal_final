import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadEnrichment, LeadScore } from '../../../core/services/leads.types';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  selector: 'app-lead-enrichment-card',
  templateUrl: './lead-enrichment-card.component.html',
  styleUrl: './lead-enrichment-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, TranslatePipe, InfoTooltipComponent],
})
export class LeadEnrichmentCardComponent {
  leadEnrichment = input<LeadEnrichment | null>(null);
  leadScore = input<LeadScore | null>(null);

  protected readonly scoreValue = computed(() => this.leadScore()?.score ?? null);
  protected readonly scorePreAI = computed(() => this.leadScore()?.preAi ?? null);
  protected readonly scoreUpdatedAt = computed(() => this.formatDate(this.leadScore()?.updatedAt));
  protected readonly scoreVersion = computed(() => this.leadScore()?.version ?? null);

  protected readonly topFactors = computed(() => {
    const factors = this.leadScore()?.factors ?? {};
    return Object.entries(factors)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);
  });

  protected readonly badgeClass = computed(() => {
    const score = this.scoreValue();
    const base = 'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold shadow-inner';
    if (score === null) return `${base} bg-zinc-200 text-zinc-600`;
    if (score >= 80) return `${base} bg-emerald-500 text-white`;
    if (score >= 60) return `${base} bg-lime-400 text-zinc-900`;
    if (score >= 40) return `${base} bg-amber-400 text-zinc-900`;
    return `${base} bg-red-600 text-white`;
  });

  protected readonly formatNumber = (value: number | null | undefined, fractionDigits = 1): string | null => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  };

  protected readonly formatDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };
}
