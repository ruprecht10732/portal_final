/* eslint-disable @angular-eslint/component-selector */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { buildLeadStatusLabels, STATUS_COLORS, type LeadStatus } from '../../../core/services/leads.types';

type StatusBadgeType = 'lead';

type StatusBadgeSize = 'sm' | 'md';

@Component({
  selector: 'shared-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  status = input<LeadStatus | null>(null);
  type = input<StatusBadgeType>('lead');
  size = input<StatusBadgeSize>('sm');
  emptyLabel = input<string>('-');

  protected readonly statusLabels = computed<Record<LeadStatus, string>>(() => {
    this.lang();
    if (this.type() !== 'lead') {
      return {} as Record<LeadStatus, string>;
    }
    return buildLeadStatusLabels((key) => this.translate.instant(key));
  });

  protected readonly label = computed(() => {
    const status = this.status();
    if (!status) {
      return this.emptyLabel();
    }
    if (this.type() === 'lead') {
      return this.statusLabels()[status] ?? String(status);
    }
    return String(status);
  });

  protected readonly badgeClass = computed(() => {
    const sizeClass = this.size() === 'md' ? 'text-sm px-4 py-2' : 'text-xs px-2.5 py-1';
    const baseClass = `inline-flex items-center rounded-full font-semibold ${sizeClass}`;
    const status = this.status();

    if (this.type() === 'lead' && status) {
      return `${baseClass} ${STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600'}`;
    }

    return `${baseClass} bg-zinc-100 text-zinc-600`;
  });
}
