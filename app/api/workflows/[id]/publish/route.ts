import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { executeWorkflow } from '@/app/lib/workflowEngine';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { is_published, apply_to_existing } = await req.json();

        // Update workflow with publish status and apply_to_existing setting
        const { data, error } = await supabase
            .from('workflows')
            .update({ is_published, apply_to_existing: apply_to_existing || false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // If publishing with apply_to_existing enabled, trigger for all existing leads in the trigger stage
        if (is_published && apply_to_existing && data.trigger_stage_id) {
            console.log(`Publishing workflow ${id} with apply_to_existing - fetching leads in stage ${data.trigger_stage_id}`);

            // Fetch all leads currently in the trigger stage
            const { data: leads, error: leadsError } = await supabase
                .from('leads')
                .select('id, sender_id')
                .eq('stage_id', data.trigger_stage_id);

            if (leadsError) {
                console.error('Error fetching leads for apply_to_existing:', leadsError);
            } else if (leads && leads.length > 0) {
                console.log(`Triggering workflow for ${leads.length} existing leads`);

                // Check which leads already have an execution for this workflow to avoid duplicates
                const { data: existingExecutions } = await supabase
                    .from('workflow_executions')
                    .select('lead_id')
                    .eq('workflow_id', id);

                const existingLeadIds = new Set(existingExecutions?.map(e => e.lead_id) || []);

                // Trigger workflow for each lead that doesn't already have an execution
                for (const lead of leads) {
                    if (!existingLeadIds.has(lead.id)) {
                        console.log(`Executing workflow for existing lead: ${lead.id}`);
                        // Execute in background - don't await to avoid blocking
                        executeWorkflow(id, lead.id, lead.sender_id, true).catch(err => {
                            console.error(`Error executing workflow for lead ${lead.id}:`, err);
                        });
                    } else {
                        console.log(`Skipping lead ${lead.id} - already has execution`);
                    }
                }
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error publishing workflow:', error);
        return NextResponse.json({ error: 'Failed to publish workflow' }, { status: 500 });
    }
}
