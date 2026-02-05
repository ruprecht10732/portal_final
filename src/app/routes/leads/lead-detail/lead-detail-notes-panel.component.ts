import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import type { LeadNoteType } from '../../../core/services/leads.types';
import { ActivityNotesComponent, type ActivityNoteEntry } from '../../../shared/components/activity-notes/activity-notes.component';

@Component({
  selector: 'app-lead-detail-notes-panel',
  templateUrl: './lead-detail-notes-panel.component.html',
  styleUrl: './lead-detail-notes-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActivityNotesComponent],
})
export class LeadDetailNotesPanelComponent {
  noteId = input<string>('note-input');
  noteText = input<string>('');
  noteType = input<LeadNoteType>('note');
  canSubmit = input<boolean>(false);
  isSaving = input<boolean>(false);
  activityFeed = input<ActivityNoteEntry[]>([]);
  formatTimestamp = input<(value: string) => string>((value) => value);
  showHeader = input<boolean>(true);

  noteTextChange = output<string>();
  noteTypeChange = output<LeadNoteType>();
  addNote = output<void>();

  protected readonly notesPanel = viewChild<ActivityNotesComponent>('notesPanel');

  focusInput(): void {
    this.notesPanel()?.focusInput();
  }

  isVisible(): boolean {
    return this.notesPanel()?.isVisible() ?? false;
  }
}
