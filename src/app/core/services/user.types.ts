export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: string;
  roles: string[];
  hasOrganization: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
}

export interface UpdateProfileRequest {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredLanguage?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CompleteOnboardingRequest {
  firstName: string;
  lastName: string;
  organizationName?: string;
}
