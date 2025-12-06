import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getBotResponse } from '@/app/lib/chatService';
import { supabase } from '@/app/lib/supabase';
import { getOrCreateLead, incrementMessageCount, shouldAnalyzeStage, analyzeAndUpdateStage, moveLeadToReceiptStage } from '@/app/lib/pipelineService';
import { analyzeImageForReceipt, isConfirmedReceipt } from '@/app/lib/receiptDetectionService';

// Cache settings to avoid database calls on every request
let cachedSettings: any = null;
let settingsLastFetched = 0;
const SETTINGS_CACHE_MS = 60000; // 1 minute cache

// Fetch settings from database with caching
async function getSettings() {
    const now = Date.now();
    if (cachedSettings && now - settingsLastFetched < SETTINGS_CACHE_MS) {
        return cachedSettings;
    }

    try {
        const { data, error } = await supabase
            .from('bot_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching settings:', error);
            return {
                facebook_verify_token: 'TEST_TOKEN',
                facebook_page_access_token: null,
            };
        }

        cachedSettings = data;
        settingsLastFetched = now;
        return data;
    } catch (error) {
        console.error('Error fetching settings:', error);
        return {
            facebook_verify_token: 'TEST_TOKEN',
            facebook_page_access_token: null,
        };
    }
}

export async function GET(req: Request) {
    const settings = await getSettings();
    const VERIFY_TOKEN = settings.facebook_verify_token || process.env.FACEBOOK_VERIFY_TOKEN || 'TEST_TOKEN';
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

// Track processed message IDs to prevent duplicates (Facebook retries webhooks)
const processedMessages = new Set<string>();
const MAX_PROCESSED_CACHE = 1000;

function cleanupProcessedMessages() {
    if (processedMessages.size > MAX_PROCESSED_CACHE) {
        const toDelete = Array.from(processedMessages).slice(0, processedMessages.size - MAX_PROCESSED_CACHE);
        toDelete.forEach(id => processedMessages.delete(id));
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('Webhook POST received:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            for (const entry of body.entry) {
                const webhook_event = entry.messaging?.[0];
                if (!webhook_event) {
                    console.log('No messaging event found in entry:', entry);
                    continue;
                }

                const sender_psid = webhook_event.sender?.id;
                const messageId = webhook_event.message?.mid;

                // Skip if already processed (prevents duplicate responses)
                if (messageId && processedMessages.has(messageId)) {
                    console.log('Skipping duplicate message:', messageId);
                    continue;
                }

                // Mark as processed
                if (messageId) {
                    processedMessages.add(messageId);
                    cleanupProcessedMessages();
                }

                console.log('Processing message from:', sender_psid, 'mid:', messageId);

                if (webhook_event.message) {
                    // Handle image attachments for receipt detection
                    if (webhook_event.message.attachments) {
                        for (const attachment of webhook_event.message.attachments) {
                            if (attachment.type === 'image' && attachment.payload?.url) {
                                console.log('Image attachment detected:', attachment.payload.url.substring(0, 100));
                                waitUntil(
                                    handleImageMessage(sender_psid, attachment.payload.url).catch(err => {
                                        console.error('Error handling image message:', err);
                                    })
                                );
                            }
                        }
                    }

                    // Handle text messages
                    if (webhook_event.message.text) {
                        console.log('Message text:', webhook_event.message.text);
                        // Use waitUntil to ensure Vercel keeps the function alive
                        // until the message is fully processed and responded to
                        waitUntil(
                            handleMessage(sender_psid, webhook_event.message.text).catch(err => {
                                console.error('Error handling message:', err);
                            })
                        );
                    }
                }
            }
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else {
            console.log('Not a page event:', body.object);
            return new NextResponse('Not Found', { status: 404 });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}


// Send typing indicator to show bot is working
async function sendTypingIndicator(sender_psid: string, on: boolean) {
    const settings = await getSettings();
    const PAGE_ACCESS_TOKEN = settings.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!PAGE_ACCESS_TOKEN) return;

    try {
        await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: sender_psid },
                sender_action: on ? 'typing_on' : 'typing_off'
            }),
        });
    } catch (error) {
        console.error('Failed to send typing indicator:', error);
    }
}

async function handleMessage(sender_psid: string, received_message: string) {
    console.log('handleMessage called, generating response...');

    // Send typing indicator immediately
    await sendTypingIndicator(sender_psid, true);

    // Process message and send response
    try {
        // === AUTO-PIPELINE INTEGRATION ===
        // Get page access token for profile fetching
        const settings = await getSettings();
        const pageToken = settings.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

        // Track the lead and check if stage analysis is needed
        const lead = await getOrCreateLead(sender_psid, pageToken);
        if (lead) {
            const messageCount = await incrementMessageCount(lead.id);
            console.log(`Lead ${lead.id} message count: ${messageCount}`);

            // Check if we should analyze stage (runs in background, non-blocking)
            if (shouldAnalyzeStage({ ...lead, message_count: messageCount }, received_message)) {
                console.log('Triggering pipeline stage analysis...');
                // Fire and forget - don't await
                analyzeAndUpdateStage(lead, sender_psid).catch((err: unknown) => {
                    console.error('Error in stage analysis:', err);
                });
            }
        }
        // === END AUTO-PIPELINE ===


        const responseText = await getBotResponse(received_message, sender_psid);
        console.log('Bot response generated:', responseText.substring(0, 100) + '...');

        const response = {
            text: responseText,
        };

        await callSendAPI(sender_psid, response);
    } finally {
        // Turn off typing indicator
        await sendTypingIndicator(sender_psid, false);
    }
}

// Handle image messages for receipt detection
async function handleImageMessage(sender_psid: string, imageUrl: string) {
    console.log('handleImageMessage called, analyzing image for receipt...');

    try {
        // Get settings for page token
        const settings = await getSettings();
        const pageToken = settings.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

        // Get or create the lead first
        const lead = await getOrCreateLead(sender_psid, pageToken);
        if (!lead) {
            console.error('Could not get or create lead for sender:', sender_psid);
            return;
        }

        // Send typing indicator while analyzing
        await sendTypingIndicator(sender_psid, true);

        // Analyze the image for receipt
        const result = await analyzeImageForReceipt(imageUrl);
        console.log('Receipt detection result:', result);

        // If high-confidence receipt detected, move to receipt stage
        if (isConfirmedReceipt(result)) {
            console.log('Receipt confirmed! Moving lead to payment stage...');

            await moveLeadToReceiptStage(lead.id, imageUrl, result.details || 'Receipt detected by AI');

            // Send confirmation message to customer
            await callSendAPI(sender_psid, {
                text: "Salamat po! Natanggap na namin ang inyong proof of payment. I-process na namin ito at babalikan kayo shortly. 🙏"
            });
        } else {
            console.log('Image is not a receipt (confidence:', result.confidence, ')');
            // Optionally respond to non-receipt images
            // For now, we'll let the bot handle it naturally if there's accompanying text
        }
    } catch (error) {
        console.error('Error in handleImageMessage:', error);
    } finally {
        await sendTypingIndicator(sender_psid, false);
    }
}




async function callSendAPI(sender_psid: string, response: any) {
    const settings = await getSettings();
    const PAGE_ACCESS_TOKEN = settings.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    console.log('callSendAPI called, token present:', !!PAGE_ACCESS_TOKEN);

    if (!PAGE_ACCESS_TOKEN) {
        console.warn('FACEBOOK_PAGE_ACCESS_TOKEN not set, skipping message send.');
        return;
    }

    const requestBody = {
        recipient: {
            id: sender_psid,
        },
        message: response,
    };

    console.log('Sending to Facebook:', JSON.stringify(requestBody, null, 2));

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const resText = await res.text();
        console.log('Facebook API response:', res.status, resText);

        if (!res.ok) {
            console.error('Unable to send message:', resText);
        }
    } catch (error) {
        console.error('Unable to send message:', error);
    }
}
