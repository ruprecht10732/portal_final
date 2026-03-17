export interface DecodedJwtClaims {
  sub?: string;
  email?: string;
  exp?: number;
}

const normalizeBase64Url = (value: string): string => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = normalized.length % 4;
  if (padding === 0) {
    return normalized;
  }

  return normalized.padEnd(normalized.length + (4 - padding), '=');
};

export const decodeJwtClaims = (token: string): DecodedJwtClaims | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadSegment = parts[1];
    if (!payloadSegment) {
      return null;
    }

    const payload = atob(normalizeBase64Url(payloadSegment));
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as DecodedJwtClaims;
  } catch {
    return null;
  }
};

export const isJwtExpired = (token: string): boolean => {
  const claims = decodeJwtClaims(token);
  if (typeof claims?.exp !== 'number') {
    return false;
  }

  return claims.exp * 1000 <= Date.now();
};