import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const DEFAULT_REGION: CountryCode = 'NL';

export function normalizePhoneE164(input: string, region: CountryCode = DEFAULT_REGION): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parsed = parsePhoneNumberFromString(trimmed, region);
  if (!parsed || !parsed.isValid()) {
    return trimmed;
  }

  return parsed.format('E.164');
}

export function formatPhoneDisplay(input: string, region: CountryCode = DEFAULT_REGION): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parsed = parsePhoneNumberFromString(trimmed, region);
  if (!parsed || !parsed.isValid()) {
    return trimmed;
  }

  return parsed.formatInternational();
}
