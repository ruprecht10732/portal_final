import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { LeadsService } from '../../core/services/leads.service';
import type { CreateLeadRequest, Lead } from '../../core/services/leads.types';
import { ServiceTypesService } from '../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../core/services/service-types.types';
import {
  REPLY_SUGGESTION_SCENARIO_OPTIONS,
  isNonGenericReplyScenario,
  type ReplySuggestionScenario,
} from '../../core/services/reply-suggestion.types';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import type { IMAPAccount, IMAPMessage, IMAPMessageContent, IMAPOutboundMessage } from '../../core/services/user.types';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SelectComponent, type SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-inbox',
  imports: [TranslateModule, RouterLink, ButtonComponent, PageLayoutComponent, LucideAngularModule, SelectComponent],
  templateUrl: './inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class InboxComponent {
  private readonly userService = inject(UserService);
  private readonly leadsService = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly imapUnreadCount = inject(IMAPUnreadCountService);

  protected readonly accounts = signal<IMAPAccount[]>([]);
  protected readonly selectedAccountId = signal<string | null>(null);
  protected readonly messages = signal<IMAPMessage[]>([]);
  protected readonly outboxMessages = signal<IMAPOutboundMessage[]>([]);
  protected readonly loadingAccounts = signal(false);
  protected readonly loadingMessages = signal(false);
  protected readonly loadingOutbox = signal(false);
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
  protected readonly suggestingReply = signal(false);
  protected readonly composerMode = signal<'new' | 'reply' | 'replyAll'>('new');
  protected readonly suggestionScenario = signal<ReplySuggestionScenario>('generic');
  protected readonly suggestionScenarioNotes = signal('');
  protected readonly aiSuggestionSeed = signal<string | null>(null);
  protected readonly aiSuggestionUid = signal<number | null>(null);
  protected readonly today = signal(new Date());
  protected readonly loadingMessageContent = signal(false);
  protected readonly messageContent = signal<IMAPMessageContent | null>(null);
  protected readonly safeMessageHtml = signal<SafeHtml | null>(null);
  protected readonly messageHtmlUrl = signal<SafeResourceUrl | null>(null);
  protected readonly availableServiceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly leadSearchQuery = signal('');
  protected readonly leadSearchResults = signal<Lead[]>([]);
  protected readonly leadSearchLoading = signal(false);
  protected readonly leadRelationshipBusy = signal<'link' | 'unlink' | 'create' | null>(null);
  protected readonly showLeadSearchPanel = signal(false);
  protected readonly showCreateLeadPanel = signal(false);
  protected readonly createLeadFirstName = signal('');
  protected readonly createLeadLastName = signal('');
  protected readonly createLeadPhone = signal('');
  protected readonly createLeadStreet = signal('');
  protected readonly createLeadHouseNumber = signal('');
  protected readonly createLeadZipCode = signal('');
  protected readonly createLeadCity = signal('');
  protected readonly createLeadServiceType = signal('');
  protected readonly createLeadConsumerRole = signal<'Owner' | 'Tenant' | 'Landlord'>('Owner');
  protected readonly isMobileViewport = signal(false);

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

  protected readonly showListPane = computed(() => !this.isMobileViewport() || this.selectedMessage() == null);

  protected readonly showReaderPane = computed(() => !this.isMobileViewport() || this.selectedMessage() != null);
  protected readonly linkedLeadSummary = computed(() => this.messageContent()?.linkedLead ?? null);
  protected readonly suggestedLeadSummary = computed(() => this.linkedLeadSummary() ? null : (this.messageContent()?.suggestedLead ?? null));
  protected readonly canCreateMessageLead = computed(() => {
    return !!this.selectedMessage()
      && this.createLeadFirstName().trim() !== ''
      && this.createLeadLastName().trim() !== ''
      && this.createLeadPhone().trim() !== ''
      && this.createLeadStreet().trim() !== ''
      && this.createLeadHouseNumber().trim() !== ''
      && this.createLeadZipCode().trim() !== ''
      && this.createLeadCity().trim() !== ''
      && this.createLeadServiceType().trim() !== ''
      && this.leadRelationshipBusy() !== 'create';
  });

  protected readonly canSuggestReply = computed(() => {
    const selectedMessage = this.selectedMessage();
    const mode = this.composerMode();
    return this.composerOpen()
      && selectedMessage !== null
      && (mode === 'reply' || mode === 'replyAll')
      && !this.composerSending()
      && !this.suggestingReply();
  });
  protected readonly suggestionScenarioOptions = REPLY_SUGGESTION_SCENARIO_OPTIONS.map<SelectOption<ReplySuggestionScenario>>(option => ({
    label: option.label,
    value: option.value,
  }));
  protected readonly selectedSuggestionScenarioDescription = computed(() => {
    return REPLY_SUGGESTION_SCENARIO_OPTIONS.find(option => option.value === this.suggestionScenario())?.description ?? '';
  });
  protected readonly showSuggestionScenarioNotes = computed(() => isNonGenericReplyScenario(this.suggestionScenario()));

  protected readonly hasActiveAISuggestion = computed(() => {
    const selectedMessage = this.selectedMessage();
    const aiSuggestion = this.aiSuggestionSeed();
    return this.composerOpen()
      && selectedMessage !== null
      && aiSuggestion !== null
      && this.aiSuggestionUid() === selectedMessage.uid;
  });

  protected readonly willLearnEditedAISuggestion = computed(() => {
    if (!this.hasActiveAISuggestion()) {
      return false;
    }
    const aiSuggestion = this.aiSuggestionSeed()?.trim() ?? '';
    const currentBody = this.composerBody().trim();
    return currentBody !== '' && currentBody !== aiSuggestion;
  });

  constructor() {
    if (globalThis.window !== undefined) {
      const mediaQuery = globalThis.window.matchMedia('(max-width: 1023px)');
      const syncViewport = () => this.isMobileViewport.set(mediaQuery.matches);
      syncViewport();
      mediaQuery.addEventListener('change', syncViewport);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', syncViewport));
    }

    this.loadAccounts();
    this.loadServiceTypes();
  }

  protected loadServiceTypes(): void {
    this.serviceTypesService.listActive()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.availableServiceTypes.set(response.items ?? []);
        const firstItem = response.items[0];
        if (!this.createLeadServiceType() && firstItem) {
          this.createLeadServiceType.set(firstItem.name);
        }
      });
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
            this.outboxMessages.set([]);
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
        this.imapUnreadCount.refresh();
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
        this.imapUnreadCount.refresh();
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
      .subscribe(() => this.imapUnreadCount.refresh());
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

  protected closeReading(): void {
    this.selectedMessageUid.set(null);
    this.messageContent.set(null);
    this.safeMessageHtml.set(null);
    this.setMessageHtmlUrl(null);
    this.resetLeadPanels();
  }

  protected openReading(message: IMAPMessage): void {
    this.selectedMessageUid.set(message.uid);
    this.viewMode.set('inbox');
    this.resetLeadPanels();
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
    this.clearAISuggestion();
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
    this.clearAISuggestion();
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
    this.resetComposerState('new');
    this.composerOpen.set(true);
  }

  protected closeComposer(): void {
    this.resetComposerState();
    this.composerOpen.set(false);
  }

  protected suggestReply(): void {
    const account = this.selectedAccount();
    const selectedMessage = this.selectedMessage();
    const mode = this.composerMode();
    if (!account || !selectedMessage || this.suggestingReply() || (mode !== 'reply' && mode !== 'replyAll')) {
      return;
    }

    this.suggestingReply.set(true);
    const scenarioNotes = this.suggestionScenarioNotes().trim();
    const request = scenarioNotes
      ? { scenario: this.suggestionScenario(), scenarioNotes }
      : { scenario: this.suggestionScenario() };
    this.userService
      .suggestIMAPReply(account.id, selectedMessage.uid, request)
      .pipe(
        catchError(error => {
          this.loadOutboundMessages(account.id);
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.sendMessage'));
          return EMPTY;
        }),
        finalize(() => this.suggestingReply.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ suggestion, effectiveScenario }) => {
        this.composerBody.set(suggestion);
        this.aiSuggestionSeed.set(suggestion);
        this.aiSuggestionUid.set(selectedMessage.uid);
        this.suggestionScenario.set((effectiveScenario as ReplySuggestionScenario | undefined) ?? this.suggestionScenario());
      });
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
    const aiSuggestion = this.activeAISuggestion();
    const request$ = (() => {
      if (mode === 'reply' && selected) {
        const payload = {
          body,
          isHtml: false,
          ...(aiSuggestion ? { aiSuggestion } : {}),
          ...(aiSuggestion ? { scenario: this.suggestionScenario() } : {}),
        };
        return this.userService.replyIMAPMessage(account.id, selected.uid, {
          ...payload,
        });
      }
      if (mode === 'replyAll' && selected) {
        const payload = {
          body,
          isHtml: false,
          ...(aiSuggestion ? { aiSuggestion } : {}),
          ...(aiSuggestion ? { scenario: this.suggestionScenario() } : {}),
        };
        return this.userService.replyAllIMAPMessage(account.id, selected.uid, {
          ...payload,
        });
      }
      return this.userService.sendIMAPMessage(account.id, {
        to,
        cc,
        subject: this.composerSubject().trim() || '(No subject)',
        body,
        isHtml: false,
      });
    })();
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
        this.resetComposerState();
        this.loadMessages(account.id);
      });
  }

  protected aiLearningIndicatorText(): string {
    if (!this.hasActiveAISuggestion()) {
      return '';
    }
    if (this.willLearnEditedAISuggestion()) {
      return this.translate.instant('profile.imap.inbox.aiDraft.learningEdited');
    }
    return this.translate.instant('profile.imap.inbox.aiDraft.active');
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

  protected formatOutboundTime(message: IMAPOutboundMessage): string {
    return this.outboundDate(message).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  protected formatOutboundFullDate(message: IMAPOutboundMessage): string {
    return this.outboundDate(message).toLocaleString(undefined, {
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

  protected outboxRecipientLabel(message: IMAPOutboundMessage): string {
    const recipients = [...message.toAddresses, ...message.ccAddresses].filter(value => value.trim() !== '');
    const primary = recipients[0] ?? 'Onbekende ontvanger';
    return recipients.length > 1 ? `${primary} +${recipients.length - 1}` : primary;
  }

  protected outboxStatusLabel(message: IMAPOutboundMessage): string {
    switch (message.status) {
      case 'sent':
        return 'Verzonden';
      case 'failed':
        return 'Mislukt';
      default:
        return 'Bezig';
    }
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

  private outboundDate(message: IMAPOutboundMessage): Date {
    return new Date(message.sentAt || message.createdAt);
  }

  private loadMessages(accountId: string): void {
    this.loadingMessages.set(true);
    this.loadOutboundMessages(accountId);
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
        if (response.items.some(message => message.uid === this.selectedMessageUid())) {
          const selectedUID = this.selectedMessageUid();
          const selectedAccountID = this.selectedAccountId();
          if (selectedUID != null && selectedAccountID) {
            this.loadMessageContent(selectedAccountID, selectedUID);
          }
        } else {
          this.selectedMessageUid.set(null);
          this.messageContent.set(null);
          this.safeMessageHtml.set(null);
          this.clearAISuggestion();
        }
      });
  }

  private loadOutboundMessages(accountId: string): void {
    this.loadingOutbox.set(true);
    this.userService
      .listIMAPOutboundMessages(accountId)
      .pipe(
        catchError(() => {
          this.outboxMessages.set([]);
          return EMPTY;
        }),
        finalize(() => this.loadingOutbox.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => this.outboxMessages.set(response.items ?? []));
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

  protected toggleLeadSearchPanel(): void {
    const nextValue = !this.showLeadSearchPanel();
    this.showLeadSearchPanel.set(nextValue);
    if (nextValue) {
      this.showCreateLeadPanel.set(false);
    }
  }

  protected openCreateLeadPanel(): void {
    this.prefillCreateLeadFromMessage();
    this.showCreateLeadPanel.set(true);
    this.showLeadSearchPanel.set(false);
  }

  protected closeCreateLeadPanel(): void {
    this.showCreateLeadPanel.set(false);
  }

  protected searchExistingLeads(): void {
    const query = this.leadSearchQuery().trim();
    if (query.length < 2) {
      this.leadSearchResults.set([]);
      return;
    }

    this.leadSearchLoading.set(true);
    this.leadsService.list({ search: query, pageSize: 6 })
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.leadSearchLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => this.leadSearchResults.set(response.items ?? []));
  }

  protected linkSuggestedLead(): void {
    const suggestedLead = this.suggestedLeadSummary();
    if (!suggestedLead) {
      return;
    }
    this.linkMessageLead(suggestedLead.id);
  }

  protected linkMessageLead(leadId: string): void {
    const account = this.selectedAccount();
    const message = this.selectedMessage();
    if (!account || !message || !leadId || this.leadRelationshipBusy()) {
      return;
    }

    this.leadRelationshipBusy.set('link');
    this.userService.linkIMAPMessageLead(account.id, message.uid, { leadId })
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyLeadLinkResponse(response.linkedLead ?? null, response.suggestedLead ?? null);
        this.showLeadSearchPanel.set(false);
        this.leadSearchResults.set([]);
        this.toast.success('E-mail gekoppeld aan lead.');
      });
  }

  protected unlinkMessageLead(): void {
    const account = this.selectedAccount();
    const message = this.selectedMessage();
    if (!account || !message || this.leadRelationshipBusy()) {
      return;
    }

    this.leadRelationshipBusy.set('unlink');
    this.userService.unlinkIMAPMessageLead(account.id, message.uid)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.loadMessageContent(account.id, message.uid);
        this.toast.success('E-mail ontkoppeld van lead.');
      });
  }

  protected createLeadFromMessage(): void {
    const account = this.selectedAccount();
    const message = this.selectedMessage();
    const content = this.messageContent();
    if (!account || !message || !content || !this.canCreateMessageLead()) {
      return;
    }

    const payload: CreateLeadRequest = {
      firstName: this.createLeadFirstName().trim(),
      lastName: this.createLeadLastName().trim(),
      phone: this.createLeadPhone().trim(),
      consumerRole: this.createLeadConsumerRole(),
      street: this.createLeadStreet().trim(),
      houseNumber: this.createLeadHouseNumber().trim(),
      zipCode: this.createLeadZipCode().trim(),
      city: this.createLeadCity().trim(),
      serviceType: this.createLeadServiceType().trim(),
      source: 'email_inbox',
      ...(content.fromAddress ? { email: content.fromAddress } : {}),
    };

    this.leadRelationshipBusy.set('create');
    this.userService.createLeadFromIMAPMessage(account.id, message.uid, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadMessages'));
          return EMPTY;
        }),
        finalize(() => this.leadRelationshipBusy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.applyLeadLinkResponse(response.linkedLead ?? null, null);
        this.showCreateLeadPanel.set(false);
        this.toast.success('Lead aangemaakt vanuit e-mail inbox.');
      });
  }

  private setMessageHtmlUrl(html: string | null): void {
    if (this.messageHtmlObjectUrl) {
      URL.revokeObjectURL(this.messageHtmlObjectUrl);
      this.messageHtmlObjectUrl = null;
    }

    if (html?.trim()) {
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
      .subscribe(() => this.imapUnreadCount.refresh());
  }

  private parseAddressList(value: string): string[] {
    return value
      .split(/[;,]/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  private applyLeadLinkResponse(linkedLead: IMAPMessageContent['linkedLead'], suggestedLead: IMAPMessageContent['suggestedLead']): void {
    const current = this.messageContent();
    if (!current) {
      return;
    }
    this.messageContent.set({
      ...current,
	      linkedLead: linkedLead ?? null,
	      suggestedLead: suggestedLead ?? null,
    });
  }

  private prefillCreateLeadFromMessage(): void {
    const current = this.selectedMessage();
    const content = this.messageContent();
    const sourceName = (current?.fromName ?? content?.fromName ?? '').trim();
    const [firstName, lastName] = this.splitName(sourceName);
    this.createLeadFirstName.set(firstName);
    this.createLeadLastName.set(lastName);
    this.createLeadPhone.set(this.suggestedLeadSummary()?.phone ?? '');
    this.createLeadStreet.set('');
    this.createLeadHouseNumber.set('');
    this.createLeadZipCode.set('');
    this.createLeadCity.set(this.suggestedLeadSummary()?.city ?? '');
    const firstServiceType = this.availableServiceTypes()[0];
    if (!this.createLeadServiceType() && firstServiceType) {
	      this.createLeadServiceType.set(firstServiceType.name);
    }
  }

  private splitName(value: string): [string, string] {
    const trimmed = value.trim();
    if (!trimmed) {
      return ['', ''];
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return [trimmed, ''];
    }
    return [parts[0] ?? '', parts.slice(1).join(' ')];
  }

  private resetLeadPanels(): void {
    this.showLeadSearchPanel.set(false);
    this.showCreateLeadPanel.set(false);
    this.leadSearchQuery.set('');
    this.leadSearchResults.set([]);
    this.leadSearchLoading.set(false);
    this.leadRelationshipBusy.set(null);
  }

  private activeAISuggestion(): string | null {
    if (!this.hasActiveAISuggestion()) {
      return null;
    }
    return this.aiSuggestionSeed();
  }

  private clearAISuggestion(): void {
    this.aiSuggestionSeed.set(null);
    this.aiSuggestionUid.set(null);
  }

  private resetComposerState(mode: 'new' | 'reply' | 'replyAll' = 'new'): void {
    this.composerMode.set(mode);
    this.composerTo.set('');
    this.composerCc.set('');
    this.composerSubject.set('');
    this.composerBody.set('');
    this.suggestionScenario.set('generic');
    this.suggestionScenarioNotes.set('');
    this.clearAISuggestion();
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
