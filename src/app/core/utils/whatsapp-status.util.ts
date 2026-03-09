import { TranslateService } from '@ngx-translate/core';

const WHATSAPP_STATUS_MESSAGE_TRANSLATION_KEYS: Record<string, string> = {
  'Device configuration lost upstream. Please register again.': 'organization.settings.whatsapp.messages.deviceConfigLostUpstream',
};

export function localizeWhatsAppStatusMessage(
  message: string | null | undefined,
  translate: TranslateService,
): string | null {
  const normalized = message?.trim();
  if (!normalized) {
    return null;
  }

  const translationKey = WHATSAPP_STATUS_MESSAGE_TRANSLATION_KEYS[normalized];
  if (!translationKey) {
    return normalized;
  }

  return translate.instant(translationKey);
}