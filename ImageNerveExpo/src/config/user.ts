/**
 * Single source of truth for current user identity.
 * Used until real auth (e.g. Firebase) is added; then replace with auth context.
 */
export const CURRENT_USER_ID = 'test-user-001';

/** Alias for API calls and components that expect "userId". */
export const getCurrentUserId = (): string => CURRENT_USER_ID;
