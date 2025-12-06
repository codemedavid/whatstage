import { supabase } from './supabase';
import { sendMessengerMessage, disableBotForLead } from './messengerService';
import { getBotResponse } from './chatService';

interface WorkflowNode {
    id: string;
    type: 'custom';
    data: {
        type: string;
        label: string;
        description?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    };
}

interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
}

interface WorkflowData {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

interface ExecutionContext {
    leadId: string;
    senderId: string;
    conversationHistory?: string;
    lastMessageTime?: Date;
}

export async function executeWorkflow(
    workflowId: string,
    leadId: string,
    senderId: string
): Promise<void> {
    console.log(`Starting workflow ${workflowId} for lead ${leadId}`);

    // Get workflow data
    const { data: workflow } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('is_published', true)
        .single();

    if (!workflow) {
        console.error('Workflow not found or not published:', workflowId);
        return;
    }

    const workflowData = workflow.workflow_data as WorkflowData;

    // Find trigger node
    const triggerNode = workflowData.nodes.find(n => n.data.type === 'trigger');
    if (!triggerNode) {
        console.error('No trigger node found in workflow');
        return;
    }

    // Create execution record
    const { data: execution } = await supabase
        .from('workflow_executions')
        .insert({
            workflow_id: workflowId,
            lead_id: leadId,
            current_node_id: triggerNode.id,
            execution_data: { senderId },
            status: 'pending',
        })
        .select()
        .single();

    if (!execution) {
        console.error('Failed to create execution record');
        return;
    }

    // Start executing from trigger
    await continueExecution(execution.id, workflowData, { leadId, senderId });
}

export async function continueExecution(
    executionId: string,
    workflowData: WorkflowData,
    context: ExecutionContext
): Promise<void> {
    const { data: execution } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

    if (!execution || execution.status !== 'pending') {
        return;
    }

    const currentNode = workflowData.nodes.find(n => n.id === execution.current_node_id);
    if (!currentNode) {
        // End of workflow
        await supabase
            .from('workflow_executions')
            .update({ status: 'completed' })
            .eq('id', executionId);
        return;
    }

    console.log(`Executing node ${currentNode.id} (${currentNode.data.type})`);

    // Execute the node
    const nextNodeId = await executeNode(currentNode, workflowData, context, executionId);

    if (nextNodeId === 'WAIT') {
        // Node scheduled for later execution
        console.log('Execution scheduled for later');
        return;
    }

    if (nextNodeId === 'STOP') {
        // Workflow stopped
        await supabase
            .from('workflow_executions')
            .update({ status: 'stopped' })
            .eq('id', executionId);
        return;
    }

    if (!nextNodeId) {
        // End of workflow
        await supabase
            .from('workflow_executions')
            .update({ status: 'completed' })
            .eq('id', executionId);
        return;
    }

    // Update execution to next node
    await supabase
        .from('workflow_executions')
        .update({ current_node_id: nextNodeId })
        .eq('id', executionId);

    // Continue execution
    await continueExecution(executionId, workflowData, context);
}

async function executeNode(
    node: WorkflowNode,
    workflowData: WorkflowData,
    context: ExecutionContext,
    executionId: string
): Promise<string | null | 'WAIT' | 'STOP'> {
    switch (node.data.type) {
        case 'trigger':
            // Just pass through to next node
            return getNextNode(node.id, workflowData);

        case 'message':
            const messageMode = node.data.messageMode || 'custom';
            let messageText = node.data.messageText || node.data.label || 'Hello!';

            if (messageMode === 'ai') {
                // Generate AI message based on prompt + conversation context
                try {
                    // Fetch recent conversation
                    const { data: messages } = await supabase
                        .from('conversations')
                        .select('role, content')
                        .eq('sender_id', context.senderId)
                        .order('created_at', { ascending: true })
                        .limit(10);

                    const conversationContext = messages
                        ?.map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
                        .join('\n') || '';

                    const aiPrompt = `Generate a message for this customer based on the following instruction:

Instruction: ${messageText}

Recent conversation:
${conversationContext}

Respond with ONLY the message text to send, nothing else. Keep it natural and conversational in Taglish if appropriate.`;

                    messageText = await getBotResponse(aiPrompt, context.senderId);
                } catch (error) {
                    console.error('Error generating AI message:', error);
                    // Fallback to the prompt itself if AI fails
                }
            }

            await sendMessengerMessage(
                context.senderId,
                messageText,
                { messagingType: 'MESSAGE_TAG', tag: 'ACCOUNT_UPDATE' }
            );
            return getNextNode(node.id, workflowData);

        case 'wait':
            // Schedule execution for later
            const duration = parseInt(node.data.duration || '5');
            const unit = node.data.unit || 'minutes';
            const delayMs = unit === 'hours' ? duration * 3600000 :
                unit === 'days' ? duration * 86400000 :
                    duration * 60000; // minutes

            const scheduledFor = new Date(Date.now() + delayMs);

            await supabase
                .from('workflow_executions')
                .update({
                    scheduled_for: scheduledFor.toISOString(),
                    current_node_id: getNextNode(node.id, workflowData),
                })
                .eq('id', executionId);

            return 'WAIT';

        case 'smart_condition':
            const conditionMet = await evaluateSmartCondition(node, context);
            return getNextNodeByCondition(node.id, workflowData, conditionMet);

        case 'stop_bot':
            await disableBotForLead(context.leadId, node.data.reason || 'Workflow stopped');
            return 'STOP';

        default:
            console.warn('Unknown node type:', node.data.type);
            return getNextNode(node.id, workflowData);
    }
}

function getNextNode(nodeId: string, workflowData: WorkflowData): string | null {
    const edge = workflowData.edges.find(e => e.source === nodeId);
    return edge?.target || null;
}

function getNextNodeByCondition(
    nodeId: string,
    workflowData: WorkflowData,
    conditionMet: boolean
): string | null {
    const edge = workflowData.edges.find(
        e => e.source === nodeId && e.sourceHandle === (conditionMet ? 'true' : 'false')
    );
    return edge?.target || null;
}

async function evaluateSmartCondition(
    node: WorkflowNode,
    context: ExecutionContext
): Promise<boolean> {
    const conditionType = node.data.conditionType || 'has_replied';

    if (conditionType === 'has_replied') {
        // Check if user has sent a message recently
        const { data: lead } = await supabase
            .from('leads')
            .select('last_message_at')
            .eq('id', context.leadId)
            .single();

        if (!lead?.last_message_at) return false;

        const lastMessageTime = new Date(lead.last_message_at);
        const timeSinceMessage = Date.now() - lastMessageTime.getTime();
        const threshold = 3600000; // 1 hour

        return timeSinceMessage < threshold;
    }

    if (conditionType === 'ai_rule') {
        // Use AI to evaluate custom rule
        const rule = node.data.conditionRule || node.data.description;
        if (!rule) return false;

        try {
            const prompt = `You are evaluating a condition for a workflow automation.
      
Condition to check: ${rule}

Context:
- Lead ID: ${context.leadId}
- Recent conversation context available

Respond with ONLY "true" or "false" based on whether the condition is met.`;

            const response = await getBotResponse(prompt, context.senderId);
            return response.toLowerCase().includes('true');
        } catch (error) {
            console.error('Error evaluating AI condition:', error);
            return false;
        }
    }

    return false;
}

export async function triggerWorkflowsForStage(stageId: string, leadId: string): Promise<void> {
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_stage_id', stageId)
        .eq('is_published', true);

    if (!workflows || workflows.length === 0) {
        console.log('No workflows triggered for stage:', stageId);
        return;
    }

    const { data: lead } = await supabase
        .from('leads')
        .select('sender_id')
        .eq('id', leadId)
        .single();

    if (!lead) return;

    for (const workflow of workflows) {
        await executeWorkflow(workflow.id, leadId, lead.sender_id);
    }
}
