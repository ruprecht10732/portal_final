import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import type { IMAPAccount, IMAPMessage, IMAPMessageContent } from '../../core/services/user.types';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-inbox',
  imports: [TranslateModule, RouterLink, ButtonComponent, PageLayoutComponent],
  templateUrl: './inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxComponent {
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly accounts = signal<IMAPAccount[]>([]);
  protected readonly selectedAccountId = signal<string | null>(null);
  protected readonly messages = signal<IMAPMessage[]>([]);
  protected readonly loadingAccounts = signal(false);
  protected readonly loadingMessages = signal(false);
  protected readonly syncingAccountId = signal<string | null>(null);
  protected readonly deletingMessageUid = signal<number | null>(null);
  protected readonly viewMode = signal<'inbox' | 'archive'>('inbox');
  protected readonly indexFilter = signal<'unread' | 'all'>('unread');
  protected readonly visibleUnreadCount = signal(5);
  protected readonly selectedMessageUid = signal<number | null>(null);
  protected readonly archivedUids = signal<Set<number>>(new Set<number>());
  protected readonly archiveQuery = signal('');
  protected readonly composerOpen = signal(false);
  protected readonly composerTo = signal('');
  protected readonly composerCc = signal('');
  protected readonly composerSubject = signal('');
  protected readonly composerBody = signal('');
  protected readonly composerSending = signal(false);
  protected readonly composerMode = signal<'new' | 'reply' | 'replyAll'>('new');
  protected readonly today = signal(new Date());
  protected readonly loadingMessageContent = signal(false);
  protected readonly messageContent = signal<IMAPMessageContent | null>(null);
  protected readonly safeMessageHtml = signal<SafeHtml | null>(null);
  protected readonly messageHtmlUrl = signal<SafeResourceUrl | null>(null);

  private messageHtmlObjectUrl: string | null = null;

  protected readonly selectedAccount = computed(() => {
    const id = this.selectedAccountId();
    if (!id) return null;
    return this.accounts().find(account => account.id === id) ?? null;
  });

  protected readonly visibleMessages = computed(() => {
    const archived = this.archivedUids();
    const base = this.messages().filter(message => !archived.has(message.uid));
    if (this.indexFilter() === 'all') {
      return base;
    }
    return base.filter(message => !message.seen);
  });

  protected readonly indexMessages = computed(() => {
    if (this.indexFilter() === 'all') {
      return this.visibleMessages();
    }
    return this.visibleMessages().slice(0, this.visibleUnreadCount());
  });

  protected readonly hiddenUnreadCount = computed(() => {
    const unreadCount = this.visibleMessages().length;
    if (this.indexFilter() === 'all') {
      return 0;
    }
    return Math.max(0, unreadCount - this.visibleUnreadCount());
  });

  protected readonly selectedMessage = computed(() => {
    const uid = this.selectedMessageUid();
    if (uid == null) {
      return null;
    }
    return this.messages().find(message => message.uid === uid) ?? null;
  });

  protected readonly archiveResults = computed(() => {
    const query = this.archiveQuery().trim().toLowerCase();
    const archivedSet = this.archivedUids();
    const processed = this.messages().filter(message => message.seen || archivedSet.has(message.uid));
    if (!query) {
      return processed;
    }
    return processed.filter(message => {
      const haystack = [
        message.subject,
        message.fromName ?? '',
        message.fromAddress ?? '',
        message.snippet ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly archiveGroups = computed(() => {
    const groups = new Map<string, IMAPMessage[]>();
    for (const message of this.archiveResults()) {
      const key = this.monthKey(message);
      const existing = groups.get(key) ?? [];
      existing.push(message);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  });

  constructor() {
    this.loadAccounts();
  }

  protected loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.userService
      .listIMAPAccounts()
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadAccounts'));
          return EMPTY;
        }),
        finalize(() => this.loadingAccounts.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(accounts => {
        this.accounts.set(accounts);
        const firstAccount = accounts[0];
        const selected = this.selectedAccountId();
        if (!selected && firstAccount) {
          this.selectedAccountId.set(firstAccount.id);
          this.loadMessages(firstAccount.id);
        } else if (selected && !accounts.some(account => account.id === selected)) {
          this.selectedAccountId.set(firstAccount?.id ?? null);
          if (firstAccount) {
            this.loadMessages(firstAccount.id);
          } else {
            this.messages.set([]);
          }
        } else if (selected) {
          this.loadMessages(selected);
        }
      });
  }

  protected selectAccount(accountId: string): void {
    this.selectedAccountId.set(accountId);
    this.loadMessages(accountId);
  }

  protected syncAccount(accountId: string): void {
    this.syncingAccountId.set(accountId);
    this.userService
      .syncIMAPAccount(accountId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.syncAccount'));
          return EMPTY;
        }),
        finalize(() => this.syncingAccountId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.imap.messages.syncQueued'));
        this.loadMessages(accountId);
        this.loadAccounts();
      });
  }

  protected deleteMessage(accountId: string, uid: number): void {
    this.deletingMessageUid.set(uid);
    this.userService
      .deleteIMAPMessage(accountId, uid)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.deleteMessage'));
          return EMPTY;
        }),
        finalize(() => this.deletingMessageUid.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.imap.messages.messageDeleted'));
        this.messages.set(this.messages().filter(message => message.uid !== uid));
        if (this.selectedMessageUid() === uid) {
          this.selectedMessageUid.set(null);
          this.messageContent.set(null);
          this.safeMessageHtml.set(null);
          this.viewMode.set('inbox');
        }
      });
  }

  protected toggleSeen(message: IMAPMessage): void {
    const account = this.selectedAccount();
    if (!account) return;
    const nextSeen = !message.seen;
    this.messages.update(items =>
      items.map(item => (item.uid === message.uid ? { ...item, seen: nextSeen } : item)),
    );
    const request$ = nextSeen
      ? this.userService.markIMAPMessageSeen(account.id, message.uid)
      : this.userService.markIMAPMessageUnseen(account.id, message.uid);
    request$
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected isSyncing(accountId: string): boolean {
    return this.syncingAccountId() === accountId;
  }

  protected isDeletingMessage(uid: number): boolean {
    return this.deletingMessageUid() === uid;
  }

  protected goToIndex(): void {
    this.viewMode.set('inbox');
  }

  protected goToArchive(): void {
    this.viewMode.set('archive');
  }

  protected openReading(message: IMAPMessage): void {
    this.selectedMessageUid.set(message.uid);
    this.viewMode.set('inbox');
    const account = this.selectedAccount();
    if (!account) return;
    if (!message.seen) {
      this.messages.update(items =>
        items.map(item => (item.uid === message.uid ? { ...item, seen: true } : item)),
      );
      this.persistSeen(account.id, message.uid);
    }
    this.loadMessageContent(account.id, message.uid);
  }

  protected archiveCurrent(): void {
    const current = this.selectedMessage();
    if (!current) return;
    const next = new Set(this.archivedUids());
    next.add(current.uid);
    this.archivedUids.set(next);
    this.selectedMessageUid.set(null);
    this.messageContent.set(null);
    this.safeMessageHtml.set(null);
    this.viewMode.set('inbox');
  }

  protected openComposerFromReading(): void {
    const current = this.selectedMessage();
    if (!current) {
      this.openComposer();
      return;
    }
    this.composerMode.set('reply');
    this.composerTo.set(current.fromAddress ?? '');
    this.composerCc.set('');
    this.composerSubject.set(current.subject ? `Re: ${current.subject}` : 'Re:');
    this.composerBody.set('\n\n');
    this.composerOpen.set(true);
  }

  protected openReplyAllFromReading(): void {
    const current = this.selectedMessage();
    const content = this.messageContent();
    if (!current || !content) {
      this.openComposerFromReading();
      return;
    }
    this.composerMode.set('replyAll');
    const toList = content.replyTo?.length ? content.replyTo : [current.fromAddress ?? ''];
    const ccList = [...(content.to ?? []), ...(content.cc ?? [])]
      .filter(v => !!v && v.toLowerCase() !== (this.selectedAccount()?.emailAddress ?? '').toLowerCase());
    this.composerTo.set(toList.filter(Boolean).join(', '));
    this.composerCc.set(ccList.join(', '));
    this.composerSubject.set(current.subject ? `Re: ${current.subject}` : 'Re:');
    this.composerBody.set('\n\n');
    this.composerOpen.set(true);
  }

  protected openComposer(): void {
    this.composerMode.set('new');
    this.composerTo.set('');
    this.composerCc.set('');
    this.composerSubject.set('');
    this.composerBody.set('');
    this.composerOpen.set(true);
  }

  protected closeComposer(): void {
    this.composerOpen.set(false);
  }

  protected sendComposer(): void {
    if (this.composerSending()) return;
    const account = this.selectedAccount();
    if (!account) return;
    const to = this.parseAddressList(this.composerTo());
    if (to.length === 0) {
      this.toast.error(this.translate.instant('profile.imap.errors.sendMessage'));
      return;
    }
    const cc = this.parseAddressList(this.composerCc());
    const body = this.composerBody().trim();
    if (!body) {
      this.toast.error(this.translate.instant('profile.imap.errors.sendMessage'));
      return;
    }
    this.composerSending.set(true);
    const mode = this.composerMode();
    const selected = this.selectedMessage();
    const request$ = mode === 'reply' && selected
      ? this.userService.replyIMAPMessage(account.id, selected.uid, { body, isHtml: false })
      : mode === 'replyAll' && selected
        ? this.userService.replyAllIMAPMessage(account.id, selected.uid, { body, isHtml: false })
        : this.userService.sendIMAPMessage(account.id, {
            to,
            cc,
            subject: this.composerSubject().trim() || '(No subject)',
            body,
            isHtml: false,
          });
    request$
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.sendMessage'));
          return EMPTY;
        }),
        finalize(() => this.composerSending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.composerOpen.set(false);
        this.toast.success(this.translate.instant('profile.imap.inbox.messages.sent'));
        this.composerBody.set('');
        this.composerCc.set('');
        this.loadMessages(account.id);
      });
  }

  protected formatDayHeader(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  protected formatTime(message: IMAPMessage): string {
    const at = this.messageDate(message);
    return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  protected formatFullDate(message: IMAPMessage): string {
    const at = this.messageDate(message);
    return at.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected senderLabel(message: IMAPMessage): string {
    return (message.fromName || message.fromAddress || 'Unknown sender').toUpperCase();
  }

  protected loadMoreUnread(): void {
    this.visibleUnreadCount.update(v => v + 5);
  }

  protected hasSafeHtml(): boolean {
    return this.safeMessageHtml() != null;
  }

  protected monthLabel(value: string): string {
    const [year, month] = value.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  private monthKey(message: IMAPMessage): string {
    const at = this.messageDate(message);
    const year = at.getFullYear();
    const month = `${at.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private messageDate(message: IMAPMessage): Date {
    return new Date(message.sentAt || message.receivedAt || message.createdAt);
  }

  private loadMessages(accountId: string): void {
    this.loadingMessages.set(true);
    this.userService
      .listIMAPMessages(accountId, 1, 50)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.loadingMessages.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.messages.set(response.items);
        this.visibleUnreadCount.set(5);
        if (!response.items.some(message => message.uid === this.selectedMessageUid())) {
          this.selectedMessageUid.set(null);
          this.messageContent.set(null);
          this.safeMessageHtml.set(null);
        } else {
          const selectedUID = this.selectedMessageUid();
          const selectedAccountID = this.selectedAccountId();
          if (selectedUID != null && selectedAccountID) {
            this.loadMessageContent(selectedAccountID, selectedUID);
          }
        }
      });
  }

  private loadMessageContent(accountId: string, uid: number): void {
    this.loadingMessageContent.set(true);
    this.userService
      .getIMAPMessageContent(accountId, uid)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.loadingMessageContent.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(content => {
        this.messageContent.set(content);
        this.setMessageHtmlUrl(content.bodyHtml ?? null);
      });
  }

  private setMessageHtmlUrl(html: string | null): void {
    if (this.messageHtmlObjectUrl) {
      URL.revokeObjectURL(this.messageHtmlObjectUrl);
      this.messageHtmlObjectUrl = null;
    }

    if (html && html.trim()) {
      const fullDocument = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
      }
      body {
        background-color: #ffffff;
      }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`;
      const blob = new Blob([fullDocument], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      this.messageHtmlObjectUrl = url;
      this.messageHtmlUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.safeMessageHtml.set(null);
    } else {
      this.messageHtmlUrl.set(null);
      this.safeMessageHtml.set(null);
    }
  }

  private persistSeen(accountId: string, uid: number): void {
    this.userService
      .markIMAPMessageSeen(accountId, uid)
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private parseAddressList(value: string): string[] {
    return value
      .split(/[;,]/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  private normalizeError(error: unknown, fallbackKey: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = (error as { error?: { error?: string } }).error;
      if (apiError && typeof apiError === 'object' && typeof apiError.error === 'string' && apiError.error.trim()) {
        return apiError.error;
      }
    }
    return this.translate.instant(fallbackKey);
  }
}
