import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PublicLeadTrackingService } from '../../core/services/public-lead-tracking.service';
import type { AttachmentSummary, LeadPreferences, PublicLeadTrackingResponse } from '../../core/services/public-lead-tracking.types';

@Component({
  selector: 'app-lead-track',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './lead-track.component.html',
  styleUrl: './lead-track.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadTrackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PublicLeadTrackingService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<PublicLeadTrackingResponse | null>(null);
  protected readonly savingPreferences = signal(false);
  protected readonly savingInfo = signal(false);
  protected readonly uploadBusy = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadSuccess = signal(false);
  protected readonly deleteBusyId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly infoSuccess = signal(false);
  protected readonly preferencesSuccess = signal(false);
  protected readonly token = signal('');
  protected readonly showUploadSheet = signal(false);

  protected openUploadSheet(): void {
    this.showUploadSheet.set(true);
  }

  protected closeUploadSheet(): void {
    this.showUploadSheet.set(false);
  }

  protected scrollToTop(): void {
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly preferencesForm = this.fb.nonNullable.group({
    budget: [''],
    timeframe: [''],
    availability: [''],
    extraNotes: [''],
  });

  protected readonly infoForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(5)]],
  });

  protected readonly steps = computed(() => {
    const current = this.data()?.status.step ?? 1;
    return [1, 2, 3, 4].map(step => ({ step, active: step <= current }));
  });

  protected readonly imageAttachments = computed<AttachmentSummary[]>(() => {
    const attachments = this.data()?.attachments ?? [];
    return attachments.filter(att => att.contentType?.startsWith('image/') && !!att.downloadUrl);
  });

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('Deze link is ongeldig.');
      this.loading.set(false);
      return;
    }

    this.token.set(token);
    this.load(token);

    this.destroyRef.onDestroy(() => {
      this.preferencesForm.reset();
      this.infoForm.reset();
    });
  }

  protected submitPreferences(): void {
    if (this.savingPreferences()) return;
    const token = this.token();
    if (!token) return;

    this.preferencesSuccess.set(false);
    this.savingPreferences.set(true);

    const payload = this.preferencesForm.getRawValue();
    this.service.updatePreferences(token, payload).subscribe({
      next: () => {
        this.savingPreferences.set(false);
        this.preferencesSuccess.set(true);
        this.data.update(current => (current ? { ...current, preferences: payload } : current));
      },
      error: () => {
        this.savingPreferences.set(false);
      },
    });
  }

  protected submitInfo(): void {
    if (this.savingInfo()) return;
    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }

    const token = this.token();
    if (!token) return;

    this.infoSuccess.set(false);
    this.savingInfo.set(true);

    const payload = this.infoForm.getRawValue();
    this.service.addInfo(token, payload).subscribe({
      next: () => {
        this.savingInfo.set(false);
        this.infoSuccess.set(true);
        this.infoForm.reset();
      },
      error: () => {
        this.savingInfo.set(false);
      },
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (input) {
      input.value = '';
    }

    this.uploadFile(file);
  }

  protected deleteAttachment(att: AttachmentSummary): void {
    const token = this.token();
    if (!token) return;

    if (!window.confirm('Weet je zeker dat je deze afbeelding wilt verwijderen?')) {
      return;
    }

    this.deleteError.set(null);
    this.deleteBusyId.set(att.id);

    this.service.deleteAttachment(token, att.id).subscribe({
      next: () => {
        this.deleteBusyId.set(null);
        this.data.update(current =>
          current ? { ...current, attachments: current.attachments.filter(item => item.id !== att.id) } : current,
        );
      },
      error: () => {
        this.deleteBusyId.set(null);
        this.deleteError.set('Verwijderen is mislukt. Probeer het opnieuw.');
      },
    });
  }

  protected stepClasses(active: boolean): string {
    return active
      ? 'bg-emerald-500 text-white ring-emerald-200'
      : 'bg-zinc-200 text-zinc-500 ring-zinc-200';
  }

  private load(token: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getByToken(token).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.patchPreferences(data.preferences);
      },
      error: err => {
        if (err?.status === 404 || err?.status === 410) {
          this.error.set('Deze link is verlopen of ongeldig.');
        } else {
          this.error.set('We konden je aanvraag niet laden. Probeer het later opnieuw.');
        }
        this.loading.set(false);
      },
    });
  }

  private patchPreferences(preferences: LeadPreferences): void {
    this.preferencesForm.patchValue({
      budget: preferences?.budget ?? '',
      timeframe: preferences?.timeframe ?? '',
      availability: preferences?.availability ?? '',
      extraNotes: preferences?.extraNotes ?? '',
    });
  }

  private refreshData(token: string): void {
    this.service.getByToken(token).subscribe({
      next: data => {
        this.data.set(data);
        this.patchPreferences(data.preferences);
      },
    });
  }

  private uploadFile(file: File): void {
    const token = this.token();
    if (!token) return;

    this.uploadBusy.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(false);

    const contentType = file.type || 'application/octet-stream';
    this.service.presignUpload(token, {
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }).subscribe({
      next: presigned => {
        this.uploadToPresignedUrl(presigned.uploadUrl, file, contentType)
          .then(() => {
            this.service.confirmUpload(token, {
              fileKey: presigned.fileKey,
              fileName: file.name,
              contentType,
              sizeBytes: file.size,
            }).subscribe({
              next: () => {
                this.uploadBusy.set(false);
                this.uploadSuccess.set(true);
                this.refreshData(token);
              },
              error: () => {
                this.uploadBusy.set(false);
                this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
              },
            });
          })
          .catch(() => {
            this.uploadBusy.set(false);
            this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
          });
      },
      error: () => {
        this.uploadBusy.set(false);
        this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
      },
    });
  }

  private async uploadToPresignedUrl(url: string, file: File, contentType: string): Promise<void> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }
  }
}
