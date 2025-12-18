import { supabase } from './supabase';

// ============================================================================
// SMART PASSIVE MODE SERVICE
// Detects when AI should defer to human agents and manages the passive state
// ============================================================================

// Escalation phrases that indicate customer wants human help
const ESCALATION_PHRASES = [
    // English
    'talk to a person', 'real person', 'real agent', 'human agent', 'live agent',
    'speak to someone', 'speak to a human', 'talk to human', 'real human',
    'supervisor', 'manager', 'customer service', 'customer support',
    'not a bot', 'stop bot', 'disable bot', 'turn off bot',
    'i want a person', 'connect me to', 'transfer me',
    // Filipino/Taglish
    'ayaw ko ng bot', 'tao kausapin', 'tao po', 'pwede tao',
    'gusto ko ng tao', 'pakiusap tao', 'real tao', 'hindi bot',
    'manager po', 'supervisor po', 'human po',
];

// Frustration indicators
const FRUSTRATION_PHRASES = [
    // English
    'you don\'t understand', 'you\'re not helping', 'this is useless',
    'terrible service', 'worst bot', 'stupid bot', 'dumb bot',
    'not what i asked', 'wrong answer', 'that\'s not right',
    'already told you', 'i said', 'how many times',
    'this is frustrating', 'so frustrating', 'i\'m frustrated',
    // Filipino/Taglish
    'hindi mo maintindihan', 'di mo gets', 'mali sagot',
    'bobo bot', 'tanga', 'walang kwenta', 'useless',
    'sinabi ko na', 'ilang beses', 'nakakainis',
];

// Similarity threshold for question repetition (0.0 to 1.0)
const SIMILARITY_THRESHOLD = 0.7;
const MAX_RECENT_QUESTIONS = 5;
const REPETITION_TRIGGER_COUNT = 2; // Same question asked this many times = trigger

export interface SmartPassiveDetectionResult {
    shouldActivate: boolean;
    reason: string | null;
    confidence: number; // 0.0 to 1.0
    triggerType: 'escalation' | 'frustration' | 'repetition' | 'low_confidence' | null;
}

export interface SmartPassiveState {
    isActive: boolean;
    activatedAt: string | null;
    reason: string | null;
    unansweredCount: number;
}

/**
 * Normalize text for comparison (lowercase, remove punctuation, trim)
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate similarity between two strings (simple word overlap)
 */
function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(normalizeText(text1).split(' '));
    const words2 = new Set(normalizeText(text2).split(' '));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
}

/**
 * Check if message contains escalation phrases
 */
function containsEscalationPhrase(message: string): { found: boolean; phrase: string | null } {
    const normalized = normalizeText(message);

    for (const phrase of ESCALATION_PHRASES) {
        if (normalized.includes(normalizeText(phrase))) {
            return { found: true, phrase };
        }
    }

    return { found: false, phrase: null };
}

/**
 * Check if message contains frustration indicators
 */
function containsFrustrationPhrase(message: string): { found: boolean; phrase: string | null } {
    const normalized = normalizeText(message);

    for (const phrase of FRUSTRATION_PHRASES) {
        if (normalized.includes(normalizeText(phrase))) {
            return { found: true, phrase };
        }
    }

    // Check for all caps (shouting)
    const uppercaseRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (message.length > 10 && uppercaseRatio > 0.7) {
        return { found: true, phrase: 'ALL CAPS (shouting)' };
    }

    return { found: false, phrase: null };
}

/**
 * Detect if Smart Passive mode should be activated based on message content
 */
export async function detectNeedsHumanAttention(
    message: string,
    senderId: string,
    ragConfidence?: number
): Promise<SmartPassiveDetectionResult> {
    // Check escalation phrases first (highest priority)
    const escalation = containsEscalationPhrase(message);
    if (escalation.found) {
        return {
            shouldActivate: true,
            reason: `Customer requested human assistance: "${escalation.phrase}"`,
            confidence: 0.95,
            triggerType: 'escalation',
        };
    }

    // Check frustration indicators
    const frustration = containsFrustrationPhrase(message);
    if (frustration.found) {
        return {
            shouldActivate: true,
            reason: `Customer appears frustrated: "${frustration.phrase}"`,
            confidence: 0.8,
            triggerType: 'frustration',
        };
    }

    // Check for repeated questions
    const recentQuestions = await getRecentQuestions(senderId);
    let repetitionCount = 0;

    for (const prevQuestion of recentQuestions) {
        const similarity = calculateSimilarity(message, prevQuestion);
        if (similarity >= SIMILARITY_THRESHOLD) {
            repetitionCount++;
        }
    }

    if (repetitionCount >= REPETITION_TRIGGER_COUNT) {
        return {
            shouldActivate: true,
            reason: `Customer asked similar question ${repetitionCount + 1} times`,
            confidence: 0.85,
            triggerType: 'repetition',
        };
    }

    // Check if RAG returned low confidence (context not found)
    if (ragConfidence !== undefined && ragConfidence < 0.3) {
        // Don't activate immediately, but track it
        await incrementUnansweredCount(senderId);
        const state = await getSmartPassiveState(senderId);

        if (state.unansweredCount >= 3) {
            return {
                shouldActivate: true,
                reason: `AI could not find relevant information ${state.unansweredCount} times in a row`,
                confidence: 0.7,
                triggerType: 'low_confidence',
            };
        }
    }

    return {
        shouldActivate: false,
        reason: null,
        confidence: 0,
        triggerType: null,
    };
}

/**
 * Get recent questions from the lead for repetition detection
 */
export async function getRecentQuestions(senderId: string): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('recent_questions')
            .eq('sender_id', senderId)
            .single();

        if (error || !data) return [];

        return (data.recent_questions as string[]) || [];
    } catch (error) {
        console.error('[SmartPassive] Error getting recent questions:', error);
        return [];
    }
}

/**
 * Track a question for repetition detection
 */
export async function trackQuestion(senderId: string, question: string): Promise<void> {
    try {
        const recentQuestions = await getRecentQuestions(senderId);

        // Add new question to the front, keep only the last N
        const updatedQuestions = [question, ...recentQuestions].slice(0, MAX_RECENT_QUESTIONS);

        await supabase
            .from('leads')
            .update({ recent_questions: updatedQuestions })
            .eq('sender_id', senderId);
    } catch (error) {
        console.error('[SmartPassive] Error tracking question:', error);
    }
}

/**
 * Increment the unanswered question count for a lead
 */
async function incrementUnansweredCount(senderId: string): Promise<void> {
    try {
        const { data } = await supabase
            .from('leads')
            .select('unanswered_question_count')
            .eq('sender_id', senderId)
            .single();

        const currentCount = data?.unanswered_question_count || 0;

        await supabase
            .from('leads')
            .update({ unanswered_question_count: currentCount + 1 })
            .eq('sender_id', senderId);
    } catch (error) {
        console.error('[SmartPassive] Error incrementing unanswered count:', error);
    }
}

/**
 * Activate Smart Passive mode for a lead
 */
export async function activateSmartPassive(senderId: string, reason: string): Promise<void> {
    try {
        console.log(`[SmartPassive] Activating for ${senderId}: ${reason}`);

        const { error } = await supabase
            .from('leads')
            .update({
                needs_human_attention: true,
                smart_passive_activated_at: new Date().toISOString(),
                smart_passive_reason: reason,
            })
            .eq('sender_id', senderId);

        if (error) {
            console.error('[SmartPassive] Error activating:', error);
        }
    } catch (error) {
        console.error('[SmartPassive] Error in activateSmartPassive:', error);
    }
}

/**
 * Deactivate Smart Passive mode (called when human agent responds)
 */
export async function deactivateSmartPassive(senderId: string): Promise<void> {
    try {
        console.log(`[SmartPassive] Deactivating for ${senderId}`);

        const { error } = await supabase
            .from('leads')
            .update({
                needs_human_attention: false,
                smart_passive_activated_at: null,
                smart_passive_reason: null,
                unanswered_question_count: 0,
                recent_questions: [],
            })
            .eq('sender_id', senderId);

        if (error) {
            console.error('[SmartPassive] Error deactivating:', error);
        }
    } catch (error) {
        console.error('[SmartPassive] Error in deactivateSmartPassive:', error);
    }
}

/**
 * Get the current Smart Passive state for a lead
 */
export async function getSmartPassiveState(senderId: string): Promise<SmartPassiveState> {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('needs_human_attention, smart_passive_activated_at, smart_passive_reason, unanswered_question_count')
            .eq('sender_id', senderId)
            .single();

        if (error || !data) {
            return {
                isActive: false,
                activatedAt: null,
                reason: null,
                unansweredCount: 0,
            };
        }

        return {
            isActive: data.needs_human_attention || false,
            activatedAt: data.smart_passive_activated_at,
            reason: data.smart_passive_reason,
            unansweredCount: data.unanswered_question_count || 0,
        };
    } catch (error) {
        console.error('[SmartPassive] Error getting state:', error);
        return {
            isActive: false,
            activatedAt: null,
            reason: null,
            unansweredCount: 0,
        };
    }
}

/**
 * Check if Smart Passive mode is currently active for a sender
 */
export async function isSmartPassiveActive(senderId: string): Promise<boolean> {
    const state = await getSmartPassiveState(senderId);
    return state.isActive;
}

/**
 * Reset unanswered count (called when AI gives a helpful response)
 */
export async function resetUnansweredCount(senderId: string): Promise<void> {
    try {
        await supabase
            .from('leads')
            .update({ unanswered_question_count: 0 })
            .eq('sender_id', senderId);
    } catch (error) {
        console.error('[SmartPassive] Error resetting count:', error);
    }
}

/**
 * Build context for AI prompt when Smart Passive is active
 */
export function buildSmartPassiveContext(state: SmartPassiveState): string {
    if (!state.isActive) return '';

    return `
IMPORTANT - SMART PASSIVE MODE ACTIVE:
You have detected that this customer may need human assistance.
Reason: ${state.reason || 'Customer needs additional support'}

BEHAVIOR GUIDELINES:
- Use a deferential, helpful tone
- Say things like "Let me check with my supervisor on that" or "I'll have someone from our team get back to you shortly"
- Do NOT repeat information you've already given
- If they ask the same question again, acknowledge it briefly: "I understand. Our team is looking into this for you."
- Keep responses SHORT - do not spam the user with long, unhelpful replies
- Focus on making the customer feel heard and valued
- DO NOT try to solve problems you cannot answer - it's okay to defer

`;
}
