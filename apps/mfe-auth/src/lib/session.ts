const AUTH_TOKEN_KEY = "companion_ai_access_token";
const ONBOARDING_SEEN_KEY = "companion_ai_onboarding_seen";
const USER_ROLE_KEY = "companion_ai_selected_role";
const VERIFIED_ROLE_KEY = "companion_ai_verified_role"; // Only set after login validation
const USER_EMAIL_KEY = "companion_ai_user_email"; // Used to validate role on login
const USER_EMAIL_BY_ROLE_PREFIX = "companion_ai_user_email_role_";
const USER_ROLE_BY_EMAIL_KEY = "companion_ai_user_role_by_email";
const PROFILE_NAME_KEY = "companion_ai_profile_name";
const PROFILE_NAME_BY_ROLE_PREFIX = "companion_ai_profile_name_role_";
// sessionStorage key — resets every new browser tab/window
const SESSION_STARTED_KEY = "companion_ai_session_started";
const INFO_SEEN_KEY = "companion_ai_info_seen";
const ONBOARDING_STEP_DONE_KEY = "companion_ai_onboarding_step_done";
const ROLE_STEP_DONE_KEY = "companion_ai_role_step_done";

export type UserRole = "pet-owner" | "veterinarian" | "admin";

function isValidRole(role: string): role is UserRole {
  return role === "pet-owner" || role === "veterinarian" || role === "admin";
}

function parseRoleMap(): Record<string, string> {
  const rawMap = localStorage.getItem(USER_ROLE_BY_EMAIL_KEY);
  if (!rawMap) return {};

  try {
    const parsed = JSON.parse(rawMap) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Called when the user taps "Get Started" on the SplashPage */
export function startSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.setItem(SESSION_STARTED_KEY, "true");
  sessionStorage.removeItem(INFO_SEEN_KEY);
  sessionStorage.removeItem(ONBOARDING_STEP_DONE_KEY);
  sessionStorage.removeItem(ROLE_STEP_DONE_KEY);
}

/** Returns true only if the user has passed through the SplashPage this session */
export function hasStartedSession(): boolean {
  return sessionStorage.getItem(SESSION_STARTED_KEY) === "true";
}

export function markInfoSeen() {
  sessionStorage.setItem(INFO_SEEN_KEY, "true");
}

export function hasSeenInfoStep(): boolean {
  return sessionStorage.getItem(INFO_SEEN_KEY) === "true";
}

export function markOnboardingStepDone() {
  sessionStorage.setItem(ONBOARDING_STEP_DONE_KEY, "true");
}

export function hasCompletedOnboardingStep(): boolean {
  return sessionStorage.getItem(ONBOARDING_STEP_DONE_KEY) === "true";
}

export function markRoleStepDone() {
  sessionStorage.setItem(ROLE_STEP_DONE_KEY, "true");
}

export function hasCompletedRoleStep(): boolean {
  return sessionStorage.getItem(ROLE_STEP_DONE_KEY) === "true";
}

export function saveAccessToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function markOnboardingSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
}

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
}

export function saveSelectedRole(role: string) {
  localStorage.setItem(USER_ROLE_KEY, role);
}

export function getSelectedRole(): string | null {
  return localStorage.getItem(USER_ROLE_KEY);
}

export function saveProfileName(name: string, role?: string | null) {
  localStorage.setItem(PROFILE_NAME_KEY, name);
  if (role) {
    localStorage.setItem(`${PROFILE_NAME_BY_ROLE_PREFIX}${role}`, name);
  }
}

export function getProfileNameForRole(role: string, fallback: string): string {
  return (
    localStorage.getItem(`${PROFILE_NAME_BY_ROLE_PREFIX}${role}`)
    || localStorage.getItem(PROFILE_NAME_KEY)
    || fallback
  );
}

/**
 * Store user credentials during registration for later verification
 * This allows validation that the user hasn't changed their role after login
 */
export function saveUserCredentials(email: string, role: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !isValidRole(role)) {
    throw new Error("invalid_registration_data");
  }

  const roleByEmail = parseRoleMap();
  const existingRole = roleByEmail[normalizedEmail];
  if (existingRole && existingRole !== role) {
    throw new Error("role_already_assigned_for_email");
  }

  localStorage.setItem(USER_EMAIL_KEY, normalizedEmail);
  localStorage.setItem(USER_ROLE_KEY, role);
  localStorage.setItem(`${USER_EMAIL_BY_ROLE_PREFIX}${role}`, normalizedEmail);

  roleByEmail[normalizedEmail] = role;
  localStorage.setItem(USER_ROLE_BY_EMAIL_KEY, JSON.stringify(roleByEmail));
}

/**
 * Get the user's email (legacy/global fallback)
 */
export function getUserEmail(): string | null {
  return localStorage.getItem(USER_EMAIL_KEY);
}

/**
 * Get the user's email for a specific role
 */
export function getUserEmailForRole(role: string): string | null {
  return localStorage.getItem(`${USER_EMAIL_BY_ROLE_PREFIX}${role}`);
}

function migrateLegacyRoleMapping() {
  const rawMap = localStorage.getItem(USER_ROLE_BY_EMAIL_KEY);
  if (rawMap) return;

  const legacyEmail = localStorage.getItem(USER_EMAIL_KEY);
  const legacyRole = localStorage.getItem(USER_ROLE_KEY);
  if (!legacyEmail || !legacyRole) return;

  const normalizedEmail = legacyEmail.trim().toLowerCase();
  const roleByEmail: Record<string, string> = { [normalizedEmail]: legacyRole };
  localStorage.setItem(USER_ROLE_BY_EMAIL_KEY, JSON.stringify(roleByEmail));
  localStorage.setItem(`${USER_EMAIL_BY_ROLE_PREFIX}${legacyRole}`, normalizedEmail);
}

export function getRegisteredRoleForEmail(email: string): string | null {
  migrateLegacyRoleMapping();
  const normalizedEmail = email.trim().toLowerCase();
  const roleByEmail = parseRoleMap();
  return roleByEmail[normalizedEmail] || null;
}

/**
 * Verify and set the role after successful login
 * This ensures the role matches what was registered
 */
export function verifyAndSaveRole(email: string, role: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !isValidRole(role)) return false;

  const registeredRole = getRegisteredRoleForEmail(normalizedEmail);

  // Login must use the exact role registered for this email
  if (!registeredRole) {
    console.error("No registered role found for this email");
    return false;
  }

  if (registeredRole !== role) {
    console.error("Role mismatch during login verification");
    return false;
  }

  // Persist the active role for current session
  localStorage.setItem(USER_ROLE_KEY, role);
  localStorage.setItem(USER_EMAIL_KEY, normalizedEmail);

  // Mark role as verified after successful login
  localStorage.setItem(VERIFIED_ROLE_KEY, role);
  return true;
}

export function getVerifiedRole(): UserRole | null {
  const verifiedValue = localStorage.getItem(VERIFIED_ROLE_KEY);
  if (!verifiedValue) return null;

  if (isValidRole(verifiedValue)) {
    return verifiedValue;
  }

  // Backward compatibility with older boolean flag format.
  if (verifiedValue === "true") {
    const selectedRole = localStorage.getItem(USER_ROLE_KEY);
    return selectedRole && isValidRole(selectedRole) ? selectedRole : null;
  }

  return null;
}

/**
 * Check if the user's role has been verified (they successfully logged in)
 */
export function isRoleVerified(): boolean {
  return getVerifiedRole() !== null;
}

/**
 * Clear all auth data when logging out
 */
export function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(VERIFIED_ROLE_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
}
