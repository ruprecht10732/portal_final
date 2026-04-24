import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

export interface WhatsAppQrErrorResolution {
  message: string;
  stopRefreshing: boolean;
  variant: 'error' | 'info';
}

interface WhatsAppQrErrorPayload {
  code?: string;
  error?: string;
  message?: string;
}

const WHATSAPP_QR_ERROR_CODE_TRANSLATION_KEYS: Record<string, string> = {
  ALREADY_LOGGED_IN: 'organization.settings.whatsapp.qrMessages.alreadyLinked',
};

const WHATSAPP_QR_ERROR_MESSAGE_TRANSLATION_KEYS: Record<string, string> = {
  'you are already logged in.': 'organization.settings.whatsapp.qrMessages.alreadyLinked',
};

export async function resolveWhatsAppQrError(
  error: unknown,
  translate: TranslateService,
): Promise<WhatsAppQrErrorResolution> {
  const fallback = buildFallbackResolution(translate);
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const payload = await readWhatsAppQrErrorPayload(error);
  const normalizedCode = payload?.code?.trim().toUpperCase();
  if (normalizedCode) {
    const translationKey = WHATSAPP_QR_ERROR_CODE_TRANSLATION_KEYS[normalizedCode];
    if (translationKey) {
      return buildInfoResolution(translate.instant(translationKey));
    }
  }

  const normalizedMessage = normalizePayloadMessage(payload);
  if (normalizedMessage) {
    const translationKey = WHATSAPP_QR_ERROR_MESSAGE_TRANSLATION_KEYS[normalizedMessage];
    if (translationKey) {
      return buildInfoResolution(translate.instant(translationKey));
    }
  }

  return fallback;
}

function buildFallbackResolution(translate: TranslateService): WhatsAppQrErrorResolution {
  return {
    message: translate.instant('organization.settings.whatsapp.qrFailed'),
    stopRefreshing: false,
    variant: 'error',
  };
}

function buildInfoResolution(message: string): WhatsAppQrErrorResolution {
  return {
    message,
    stopRefreshing: true,
    variant: 'info',
  };
}

async function readWhatsAppQrErrorPayload(
  error: HttpErrorResponse,
): Promise<WhatsAppQrErrorPayload | null> {
  const payload = error.error;
  if (payload instanceof Blob) {
    return parseWhatsAppQrErrorText(await payload.text());
  }

  if (typeof payload === 'string') {
    return parseWhatsAppQrErrorText(payload);
  }

  if (payload && typeof payload === 'object') {
    return payload as WhatsAppQrErrorPayload;
  }

  return null;
}

function parseWhatsAppQrErrorText(text: string): WhatsAppQrErrorPayload | null {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalizedText);
    if (parsed && typeof parsed === 'object') {
      return parsed as WhatsAppQrErrorPayload;
    }
  } catch { /* not JSON */ }

  return { message: normalizedText };
}

function normalizePayloadMessage(payload: WhatsAppQrErrorPayload | null): string | null {
  const message = payload?.message?.trim() || payload?.error?.trim();
  if (!message) {
    return null;
  }

  return message.toLowerCase();
}
