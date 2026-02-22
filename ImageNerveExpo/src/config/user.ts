/**
 * Single source of truth for current user identity.
 * Used until real auth (e.g. Firebase) is added; then replace with auth context.
 * Must match backend TEST_USER_ID.
 */
export const CURRENT_USER_ID = 'testuser';

/** Alias for API calls and components that expect "userId". */
export const getCurrentUserId = (): string => CURRENT_USER_ID;
