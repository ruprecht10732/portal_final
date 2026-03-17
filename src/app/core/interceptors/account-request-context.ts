import { HttpContext, HttpContextToken } from '@angular/common/http';

export const AUTH_ACCOUNT_UID = new HttpContextToken<string | null>(() => null);

export function withAccountUID(uid: string): HttpContext {
  return new HttpContext().set(AUTH_ACCOUNT_UID, uid);
}