import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

export interface ActivityNoteEntry {
  id: string;
  type: 'note' | 'audit';
  timestamp: string;
  user: string;
  message: string;
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
  canSubmit = input<boolean>(false);
  isSaving = input<boolean>(false);
  showHeader = input<boolean>(true);
  showLogCall = input<boolean>(false);
  logCallLabel = input<string>('Log Call');
  activityFeed = input<ActivityNoteEntry[]>([]);
  formatTimestamp = input<(value: string) => string>((value) => value);

  noteTextChange = output<string>();
  addNote = output<void>();
  logCall = output<void>();

  protected readonly noteInput = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');

  focusInput(): void {
    this.noteInput()?.nativeElement.focus();
  }

  isVisible(): boolean {
    return !!this.host.nativeElement.offsetParent;
  }
}
