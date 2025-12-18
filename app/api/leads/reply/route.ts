import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { startOrRefreshTakeover } from '@/app/lib/humanTakeoverService';
import { callSendAPI } from '@/app/api/webhook/facebookClient';

/**
 * POST /api/leads/reply
 * Send a message from an agent to a lead and trigger human takeover
 * 
 * Body: { leadId: string, message: string }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { leadId, message, senderId } = body;

        // Either leadId or senderId can be provided
        if ((!leadId && !senderId) || !message) {
            return NextResponse.json(
                { error: 'leadId (or senderId) and message are required' },
                { status: 400 }
            );
        }

        let lead;

        if (leadId) {
            // Fetch lead to get sender_id and page_id
            const { data, error } = await supabase
                .from('leads')
                .select('id, sender_id, page_id')
                .eq('id', leadId)
                .single();

            if (error || !data) {
                console.error('[AgentReply] Lead not found:', error);
                return NextResponse.json(
                    { error: 'Lead not found' },
                    { status: 404 }
                );
            }
            lead = data;
        } else {
            // Find lead by sender_id
            const { data, error } = await supabase
                .from('leads')
                .select('id, sender_id, page_id')
                .eq('sender_id', senderId)
                .single();

            if (error || !data) {
                console.error('[AgentReply] Lead not found for sender:', senderId, error);
                return NextResponse.json(
                    { error: 'Lead not found' },
                    { status: 404 }
                );
            }
            lead = data;
        }

        // Start human takeover BEFORE sending the message
        // This ensures the bot won't respond to any incoming messages
        console.log('[AgentReply] Starting human takeover for:', lead.sender_id);
        await startOrRefreshTakeover(lead.sender_id);

        // Send the message via Facebook Messenger
        console.log('[AgentReply] Sending message to:', lead.sender_id);
        await callSendAPI(lead.sender_id, { text: message }, lead.page_id);

        // Also store the message in the conversation history
        const { error: convError } = await supabase
            .from('conversations')
            .insert({
                sender_id: lead.sender_id,
                role: 'assistant', // Agent messages are stored as assistant
                content: message,
            });

        if (convError) {
            console.error('[AgentReply] Failed to store conversation:', convError);
            // Don't fail the request for this
        }

        console.log('[AgentReply] ✅ Message sent and takeover activated');

        return NextResponse.json({
            success: true,
            message: 'Message sent and human takeover activated',
            takeoverActive: true,
        });

    } catch (error) {
        console.error('[AgentReply] Error:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}
