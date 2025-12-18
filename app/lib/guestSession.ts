/**
 * Guest Session Management
 * 
 * Handles guest session IDs for users who access the store without
 * going through Facebook Messenger. Guest sessions are stored in
 * localStorage and persist across browser sessions.
 */

const GUEST_SESSION_KEY = 'guest_session_id';

/**
 * Gets the existing guest session ID or creates a new one if none exists.
 * Guest IDs use the format `guest_<uuid>` to distinguish from Messenger PSIDs.
 */
export function getOrCreateGuestSessionId(): string {
    if (typeof window === 'undefined') return '';

    let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
    if (!sessionId) {
        sessionId = `guest_${crypto.randomUUID()}`;
        localStorage.setItem(GUEST_SESSION_KEY, sessionId);
    }
    return sessionId;
}

/**
 * Gets the existing guest session ID without creating a new one.
 * Returns null if no guest session exists.
 */
export function getGuestSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(GUEST_SESSION_KEY);
}

/**
 * Clears the guest session (e.g., after order completion or manual logout).
 */
export function clearGuestSession(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(GUEST_SESSION_KEY);
    }
}

/**
 * Checks if a session ID is a guest session (vs a Messenger PSID).
 */
export function isGuestSession(sessionId: string): boolean {
    return sessionId.startsWith('guest_');
}

// ============================================================================
// FACEBOOK PARAMETERS PERSISTENCE
// Store Facebook parameters (psid, pageId) in localStorage so they persist
// when users navigate between product pages after clicking from Messenger.
// ============================================================================

const FB_PSID_KEY = 'fb_sender_psid';
const FB_PAGE_ID_KEY = 'fb_page_id';

/**
 * Stores Facebook parameters in localStorage if they are present.
 * Call this when the page loads with URL parameters.
 */
export function storeFacebookParams(psid: string | null, pageId: string | null): void {
    if (typeof window === 'undefined') return;

    if (psid) {
        localStorage.setItem(FB_PSID_KEY, psid);
    }
    if (pageId) {
        localStorage.setItem(FB_PAGE_ID_KEY, pageId);
    }
}

/**
 * Gets the stored Facebook PSID from localStorage.
 * Returns the stored value or empty string if not found.
 */
export function getStoredPsid(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(FB_PSID_KEY) || '';
}

/**
 * Gets the stored Facebook Page ID from localStorage.
 * Returns the stored value or empty string if not found.
 */
export function getStoredPageId(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(FB_PAGE_ID_KEY) || '';
}

/**
 * Gets Facebook params - first from URL, then from localStorage.
 * Also stores them if found in URL.
 */
export function getFacebookParams(urlPsid: string | null, urlPageId: string | null): { psid: string; pageId: string } {
    if (typeof window === 'undefined') return { psid: '', pageId: '' };

    // If URL has params, store them and use them
    if (urlPsid || urlPageId) {
        storeFacebookParams(urlPsid, urlPageId);
    }

    // Return URL params if available, otherwise fall back to stored values
    return {
        psid: urlPsid || getStoredPsid(),
        pageId: urlPageId || getStoredPageId(),
    };
}

/**
 * Clears stored Facebook parameters (e.g., when user logs out or session expires).
 */
export function clearFacebookParams(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(FB_PSID_KEY);
        localStorage.removeItem(FB_PAGE_ID_KEY);
    }
}
