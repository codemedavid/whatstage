import { NextResponse } from 'next/server';
import { getLeadsNeedingFollowUp, sendFollowUp } from '@/app/lib/followUpService';
import { supabase } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron job to send follow-up messages to inactive leads
 * 
 * Controlled by auto_follow_up_enabled in bot_settings.
 * Enable/disable via Bot Configuration in the dashboard.
 */
export async function GET(req: Request) {
    try {
        // Check if auto follow-up is enabled in settings
        const { data: settings } = await supabase
            .from('bot_settings')
            .select('auto_follow_up_enabled')
            .limit(1)
            .single();

        if (!settings?.auto_follow_up_enabled) {
            console.log('[FollowUpCron] Auto follow-ups disabled in settings.');
            return NextResponse.json({
                processed: 0,
                message: 'Auto follow-ups disabled. Enable in Bot Configuration.'
            });
        }

        // Verify cron secret to prevent unauthorized access
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // Only check auth if CRON_SECRET is set (production)
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            console.log('[FollowUpCron] Unauthorized request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[FollowUpCron] Starting follow-up check...');

        // Get leads that need follow-up right now
        const leads = await getLeadsNeedingFollowUp(10);

        if (leads.length === 0) {
            console.log('[FollowUpCron] No leads need follow-up');
            return NextResponse.json({ processed: 0, message: 'No leads need follow-up' });
        }

        console.log(`[FollowUpCron] Found ${leads.length} leads to follow up`);

        let successCount = 0;
        let failCount = 0;

        // Process each lead
        for (const lead of leads) {
            try {
                const success = await sendFollowUp(lead);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`[FollowUpCron] Error processing lead ${lead.id}:`, error);
                failCount++;
            }
        }

        console.log(`[FollowUpCron] Complete: ${successCount} sent, ${failCount} failed`);

        return NextResponse.json({
            processed: leads.length,
            success: successCount,
            failed: failCount,
        });
    } catch (error) {
        console.error('[FollowUpCron] Cron error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
