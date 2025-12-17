import { supabase } from './supabase';
import { deactivateSmartPassive } from './smartPassiveService';

// Cache settings to avoid database calls on every request
let cachedTimeout: number | null = null;
let timeoutLastFetched = 0;
const TIMEOUT_CACHE_MS = 60000; // 1 minute cache

/**
 * Get the human takeover timeout setting from bot_settings
 */
export async function getHumanTakeoverTimeout(): Promise<number> {
    const now = Date.now();
    if (cachedTimeout !== null && now - timeoutLastFetched < TIMEOUT_CACHE_MS) {
        return cachedTimeout;
    }

    try {
        const { data, error } = await supabase
            .from('bot_settings')
            .select('human_takeover_timeout_minutes')
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching takeover timeout:', error);
            return 5; // Default 5 minutes
        }

        cachedTimeout = data?.human_takeover_timeout_minutes ?? 5;
        timeoutLastFetched = now;
        return cachedTimeout ?? 5;
    } catch (error) {
        console.error('Error fetching takeover timeout:', error);
        return 5;
    }
}

/**
 * Clear the cached timeout (call when settings are updated)
 */
export function clearTakeoverTimeoutCache() {
    cachedTimeout = null;
    timeoutLastFetched = 0;
}

/**
 * Start or refresh a human takeover session for a lead
 * Called when a human agent sends a message to a customer
 */
export async function startOrRefreshTakeover(leadSenderId: string): Promise<void> {
    try {
        const timeoutMinutes = await getHumanTakeoverTimeout();

        // Upsert the takeover session (insert or update if exists)
        const { error } = await supabase
            .from('human_takeover_sessions')
            .upsert(
                {
                    lead_sender_id: leadSenderId,
                    last_human_message_at: new Date().toISOString(),
                    timeout_minutes: timeoutMinutes,
                },
                {
                    onConflict: 'lead_sender_id',
                }
            );

        if (error) {
            console.error('Error starting/refreshing takeover:', error);
        } else {
            console.log(`Human takeover started/refreshed for ${leadSenderId}, timeout: ${timeoutMinutes} minutes`);

            // Also deactivate Smart Passive mode since human is now handling this
            await deactivateSmartPassive(leadSenderId);
        }
    } catch (error) {
        console.error('Error in startOrRefreshTakeover:', error);
    }
}

/**
 * Check if a human takeover is currently active for a lead
 * Returns true if AI should stay silent
 */
export async function isTakeoverActive(leadSenderId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('human_takeover_sessions')
            .select('last_human_message_at, timeout_minutes')
            .eq('lead_sender_id', leadSenderId)
            .single();

        if (error) {
            // No session found = no takeover active
            if (error.code === 'PGRST116') {
                return false;
            }
            console.error('Error checking takeover status:', error);
            return false;
        }

        if (!data) {
            return false;
        }

        // Check if the takeover has expired
        const lastHumanMessage = new Date(data.last_human_message_at);
        const timeoutMs = (data.timeout_minutes || 5) * 60 * 1000;
        const now = new Date();
        const elapsed = now.getTime() - lastHumanMessage.getTime();

        if (elapsed >= timeoutMs) {
            // Takeover has expired, clean up the session
            await endTakeover(leadSenderId);
            console.log(`Human takeover expired for ${leadSenderId} (${Math.round(elapsed / 60000)} mins elapsed)`);
            return false;
        }

        const remainingMins = Math.round((timeoutMs - elapsed) / 60000);
        console.log(`Human takeover ACTIVE for ${leadSenderId}, ${remainingMins} minutes remaining`);
        return true;
    } catch (error) {
        console.error('Error in isTakeoverActive:', error);
        return false;
    }
}

/**
 * End a human takeover session (cleanup)
 */
export async function endTakeover(leadSenderId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('human_takeover_sessions')
            .delete()
            .eq('lead_sender_id', leadSenderId);

        if (error) {
            console.error('Error ending takeover:', error);
        }
    } catch (error) {
        console.error('Error in endTakeover:', error);
    }
}

/**
 * Manually end takeover for a specific lead (for UI "Resume AI" button if needed)
 */
export async function manuallyEndTakeover(leadSenderId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('human_takeover_sessions')
            .delete()
            .eq('lead_sender_id', leadSenderId);

        if (error) {
            console.error('Error manually ending takeover:', error);
            return false;
        }

        console.log(`Human takeover manually ended for ${leadSenderId}`);
        return true;
    } catch (error) {
        console.error('Error in manuallyEndTakeover:', error);
        return false;
    }
}
