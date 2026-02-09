import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadPreferences } from '../../../core/services/leads.types';

interface PreferenceItem {
  id: 'budget' | 'timeframe' | 'availability' | 'extraNotes';
  labelKey: string;
  value: string;
}

@Component({
  selector: 'app-lead-detail-preferences-tab',
  templateUrl: './lead-detail-preferences-tab.component.html',
  styleUrl: './lead-detail-preferences-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadDetailPreferencesTabComponent {
  preferences = input<LeadPreferences | null>(null);

  protected readonly preferenceItems = computed<PreferenceItem[]>(() => {
    const prefs = this.preferences() ?? {};
    return [
      {
        id: 'budget',
        labelKey: 'leads.detail.preferences.budget',
        value: prefs.budget?.trim() ?? '',
      },
      {
        id: 'timeframe',
        labelKey: 'leads.detail.preferences.timeframe',
        value: prefs.timeframe?.trim() ?? '',
      },
      {
        id: 'availability',
        labelKey: 'leads.detail.preferences.availability',
        value: prefs.availability?.trim() ?? '',
      },
      {
        id: 'extraNotes',
        labelKey: 'leads.detail.preferences.extraNotes',
        value: prefs.extraNotes?.trim() ?? '',
      },
    ];
  });

  protected readonly hasPreferences = computed(() =>
    this.preferenceItems().some((item) => item.value !== '')
  );
}
