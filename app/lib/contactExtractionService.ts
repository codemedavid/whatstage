import { supabase } from './supabase';

/**
 * Result of contact info extraction from text
 */
export interface ExtractedContactInfo {
    phone: string | null;
    email: string | null;
}

/**
 * Regex patterns for extracting contact information
 */

// Philippine phone number patterns:
// - 09xx xxx xxxx, 09xx-xxx-xxxx, 09xxxxxxxxx
// - +639xx xxx xxxx, +639xxxxxxxxx
// - 639xxxxxxxxx
const PHONE_PATTERNS = [
    // Philippine mobile: +63 9xx or 09xx formats
    /(?:\+63|0)9\d{2}[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // International format with country code
    /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    // Generic 10-11 digit number that looks like a phone
    /\b0\d{10}\b/g,
    // 11 digits starting with 09
    /\b09\d{9}\b/g,
];

// Email pattern - standard email format
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extract phone numbers from text
 */
function extractPhoneNumbers(text: string): string[] {
    const phones: string[] = [];

    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Normalize: remove spaces, dashes, dots
                const normalized = match.replace(/[-.\s]/g, '');
                if (!phones.includes(normalized)) {
                    phones.push(normalized);
                }
            });
        }
    }

    return phones;
}

/**
 * Extract email addresses from text
 */
function extractEmails(text: string): string[] {
    const matches = text.match(EMAIL_PATTERN);
    if (!matches) return [];

    // Return unique emails, lowercase
    return [...new Set(matches.map(email => email.toLowerCase()))];
}

/**
 * Extract contact information (phone numbers and emails) from text
 */
export function extractContactInfo(text: string): ExtractedContactInfo {
    const phones = extractPhoneNumbers(text);
    const emails = extractEmails(text);

    return {
        phone: phones.length > 0 ? phones[0] : null, // Take the first phone found
        email: emails.length > 0 ? emails[0] : null, // Take the first email found
    };
}

/**
 * Update a lead's contact information in the database
 * Only updates fields that are provided and not already set (won't overwrite existing data)
 */
export async function updateLeadContactInfo(
    leadId: string,
    phone: string | null,
    email: string | null
): Promise<boolean> {
    if (!phone && !email) {
        // Nothing to update
        return true;
    }

    try {
        // First, get current lead data to avoid overwriting existing contact info
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('phone, email')
            .eq('id', leadId)
            .single();

        if (fetchError) {
            console.error('Error fetching lead for contact update:', fetchError);
            return false;
        }

        // Build update object - only update if field is new and not already set
        const updates: { phone?: string; email?: string } = {};

        if (phone && !lead?.phone) {
            updates.phone = phone;
        }

        if (email && !lead?.email) {
            updates.email = email;
        }

        if (Object.keys(updates).length === 0) {
            // No new contact info to update
            console.log(`Lead ${leadId} already has contact info, skipping update`);
            return true;
        }

        // Update the lead
        const { error: updateError } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', leadId);

        if (updateError) {
            console.error('Error updating lead contact info:', updateError);
            return false;
        }

        console.log(`Lead ${leadId} contact info updated:`, updates);
        return true;

    } catch (error) {
        console.error('Error in updateLeadContactInfo:', error);
        return false;
    }
}

/**
 * Extract and store contact info from a message for a lead
 * This is the main function to call from the webhook
 */
export async function extractAndStoreContactInfo(
    leadId: string,
    messageText: string
): Promise<void> {
    const { phone, email } = extractContactInfo(messageText);

    if (phone || email) {
        console.log(`Extracted contact info from message - Phone: ${phone}, Email: ${email}`);
        await updateLeadContactInfo(leadId, phone, email);
    }
}
