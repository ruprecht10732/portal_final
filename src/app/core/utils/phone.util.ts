import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const DEFAULT_REGION: CountryCode = 'NL';

function parsePhone(input: string, region: CountryCode = DEFAULT_REGION) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  return parsePhoneNumberFromString(trimmed, region);
}

export function normalizePhoneE164(input: string, region: CountryCode = DEFAULT_REGION): string {
  const parsed = parsePhone(input, region);
  return parsed?.isValid() ? parsed.format('E.164') : input.trim();
}

export function formatPhoneDisplay(input: string, region: CountryCode = DEFAULT_REGION): string {
  const parsed = parsePhone(input, region);
  return parsed?.isValid() ? parsed.formatInternational() : input.trim();
}
