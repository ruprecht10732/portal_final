/**
 * Role name constants
 */

export const ROLES = {
  admin: 'admin',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
