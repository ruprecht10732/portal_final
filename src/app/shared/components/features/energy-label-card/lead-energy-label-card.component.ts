import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { EnergyLabel } from '../../../../core/services/leads.types';
import { CardComponent } from '../../card/card.component';
import { ChipComponent, type ChipVariant } from '../../chip/chip.component';

@Component({
  selector: 'app-lead-energy-label-card',
  templateUrl: './lead-energy-label-card.component.html',
  styleUrl: './lead-energy-label-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ChipComponent, TranslatePipe],
})
export class LeadEnergyLabelCardComponent {
  energyLabel = input<EnergyLabel | null>(null);

  protected readonly labelClass = computed(() => this.energyLabel()?.energieklasse?.toUpperCase() ?? null);

  protected readonly chipVariant = computed<ChipVariant>(() => {
    const label = this.labelClass();
    if (!label) return 'neutral';
    if (label.startsWith('A') || label.startsWith('B')) return 'success';
    if (label.startsWith('C')) return 'info';
    if (label.startsWith('D')) return 'warning';
    return 'danger';
  });

  protected readonly badgeClasses = computed(() => {
    const base = 'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold shadow-inner';
    const label = this.labelClass();
    if (!label) {
      return `${base} bg-zinc-200 text-zinc-600`;
    }
    if (label.startsWith('A')) {
      return `${base} bg-emerald-500 text-white`;
    }
    if (label.startsWith('B')) {
      return `${base} bg-green-500 text-white`;
    }
    if (label.startsWith('C')) {
      return `${base} bg-lime-400 text-zinc-900`;
    }
    if (label.startsWith('D')) {
      return `${base} bg-amber-400 text-zinc-900`;
    }
    if (label.startsWith('E')) {
      return `${base} bg-orange-500 text-white`;
    }
    if (label.startsWith('F')) {
      return `${base} bg-orange-600 text-white`;
    }
    return `${base} bg-red-600 text-white`;
  });

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

  protected readonly formatNumber = (value: number | null | undefined, fractionDigits = 1): string | null => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  };

  protected readonly validUntilValue = computed(() => this.formatDate(this.energyLabel()?.geldigTot));
  protected readonly registeredValue = computed(() => this.formatDate(this.energyLabel()?.registratiedatum));
  protected readonly buildingTypeValue = computed(() => this.energyLabel()?.gebouwtype ?? null);
  protected readonly constructionYearValue = computed(() => {
    const value = this.energyLabel()?.bouwjaar;
    return value === null || value === undefined ? null : String(value);
  });
  protected readonly energyIndexValue = computed(() => this.formatNumber(this.energyLabel()?.energieIndex, 2));
  protected readonly primaryEnergyValue = computed(() => this.formatNumber(this.energyLabel()?.primaireFossieleEnergie, 0));
}
