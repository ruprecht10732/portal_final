import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import type { LeadNoteType } from '../../../core/services/leads.types';
import { ButtonComponent } from '../button/button.component';

export interface ActivityNoteEntry {
  id: string;
  type: 'audit' | LeadNoteType;
  timestamp: string;
  user: string;
  message: string;
}

export interface NoteTypeOption {
  value: LeadNoteType;
  label: string;
}

@Component({
  selector: 'shared-activity-notes',
  templateUrl: './activity-notes.component.html',
  styleUrl: './activity-notes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  host: {
    '[class]': "'block w-full'",
  },
})
export class ActivityNotesComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  noteId = input<string>('note-input');
  noteLabel = input<string>('Add Note');
  notePlaceholder = input<string>('Add a note...');
  noteText = input<string>('');
  noteType = input<LeadNoteType>('note');
  noteTypeOptions = input<NoteTypeOption[]>([
    { value: 'note', label: 'Note' },
    { value: 'call', label: 'Call' },
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
  ]);
  showTypeSelector = input<boolean>(true);
  canSubmit = input<boolean>(false);
  isSaving = input<boolean>(false);
  showHeader = input<boolean>(true);
  activityFeed = input<ActivityNoteEntry[]>([]);
  formatTimestamp = input<(value: string) => string>((value) => value);

  noteTextChange = output<string>();
  noteTypeChange = output<LeadNoteType>();
  addNote = output<void>();

  protected readonly noteInput = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');

  focusInput(): void {
    this.noteInput()?.nativeElement.focus();
  }

  isVisible(): boolean {
    return !!this.host.nativeElement.offsetParent;
  }
}
