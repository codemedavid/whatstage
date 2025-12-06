import OpenAI from 'openai';
import { searchDocuments } from './rag';
import { supabase } from './supabase';

const MAX_HISTORY = 10; // Reduced to prevent context overload

// Cache settings to avoid database calls on every request
let cachedSettings: any = null;
let settingsLastRead = 0;
const SETTINGS_CACHE_MS = 60000; // 1 minute cache

// Fetch bot settings from database with caching
async function getBotSettings() {
    const now = Date.now();
    if (cachedSettings && now - settingsLastRead < SETTINGS_CACHE_MS) {
        return cachedSettings;
    }

    try {
        const { data, error } = await supabase
            .from('bot_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching bot settings:', error);
            return { bot_name: 'Assistant', bot_tone: 'helpful and professional' };
        }

        cachedSettings = data;
        settingsLastRead = now;
        return data;
    } catch (error) {
        console.error('Error fetching bot settings:', error);
        return { bot_name: 'Assistant', bot_tone: 'helpful and professional' };
    }
}

const client = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY,
});

// Fetch bot rules from database
async function getBotRules(): Promise<string[]> {
    try {
        const { data: rules, error } = await supabase
            .from('bot_rules')
            .select('rule')
            .eq('enabled', true)
            .order('priority', { ascending: true });

        if (error) {
            console.error('Error fetching bot rules:', error);
            return [];
        }

        return rules?.map((r: any) => r.rule) || [];
    } catch (error) {
        console.error('Error fetching bot rules:', error);
        return [];
    }
}

// Fetch bot instructions from database
async function getBotInstructions(): Promise<string> {
    try {
        const { data, error } = await supabase
            .from('bot_instructions')
            .select('instructions')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching bot instructions:', error);
            return '';
        }

        return data?.instructions || '';
    } catch (error) {
        console.error('Error fetching bot instructions:', error);
        return '';
    }
}

// Fetch conversation history for a sender (last 20 messages)
async function getConversationHistory(senderId: string): Promise<{ role: string; content: string }[]> {
    try {
        const { data: messages, error } = await supabase
            .from('conversations')
            .select('role, content')
            .eq('sender_id', senderId)
            .order('created_at', { ascending: true })
            .limit(MAX_HISTORY);

        if (error) {
            console.error('Error fetching conversation history:', error);
            return [];
        }

        return messages || [];
    } catch (error) {
        console.error('Error fetching conversation history:', error);
        return [];
    }
}

// Store a message (fire and forget - don't await)
function storeMessageAsync(senderId: string, role: 'user' | 'assistant', content: string) {
    // Run in background - don't block the response
    (async () => {
        try {
            // Delete oldest if over limit (simple approach - just insert and let periodic cleanup handle it)
            const { error: insertError } = await supabase
                .from('conversations')
                .insert({
                    sender_id: senderId,
                    role,
                    content,
                });

            if (insertError) {
                console.error('Error storing message:', insertError);
            }

            // Cleanup old messages in background
            const { count } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', senderId);

            if (count && count > MAX_HISTORY + 5) {
                // Delete oldest ones to get back to MAX_HISTORY
                const { data: oldMessages } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('sender_id', senderId)
                    .order('created_at', { ascending: true })
                    .limit(count - MAX_HISTORY);

                if (oldMessages && oldMessages.length > 0) {
                    await supabase
                        .from('conversations')
                        .delete()
                        .in('id', oldMessages.map(m => m.id));
                }
            }
        } catch (error) {
            console.error('Error in storeMessage:', error);
        }
    })();
}

export async function getBotResponse(userMessage: string, senderId: string = 'web_default'): Promise<string> {
    const startTime = Date.now();

    // Read bot configuration from database (cached)
    const settings = await getBotSettings();
    const botName = settings.bot_name || 'Assistant';
    const botTone = settings.bot_tone || 'helpful and professional';

    // Store user message immediately (fire and forget)
    storeMessageAsync(senderId, 'user', userMessage);

    // Run independent operations in PARALLEL
    const [rules, history, context, instructions] = await Promise.all([
        getBotRules(),
        getConversationHistory(senderId),
        searchDocuments(userMessage),
        getBotInstructions(),
    ]);

    console.log(`Parallel fetch took ${Date.now() - startTime}ms - rules: ${rules.length}, history: ${history.length}`);

    // Build a natural conversation-focused system prompt
    let systemPrompt = `You are ${botName}, a Filipino salesperson texting a customer about your product. You are ${botTone}.

`;

    // Add instructions from database if available
    if (instructions) {
        systemPrompt += `${instructions}

`;
    }

    if (rules.length > 0) {
        systemPrompt += `RULES TO FOLLOW:\n${rules.join('\n')}\n\n`;
    }

    if (context) {
        systemPrompt += `REFERENCE INFO (use naturally, don't quote verbatim):\n${context}\n\n`;
    }

    // Build messages array with history
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of history) {
        messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    try {
        const llmStart = Date.now();

        // Use DeepSeek 3.1 with streaming and thinking enabled
        const stream: any = await client.chat.completions.create({
            model: "deepseek-ai/deepseek-v3.1",
            messages,
            temperature: 0.4,
            top_p: 0.7,
            max_tokens: 4096,
            stream: true,
        });

        let responseContent = '';
        let reasoningContent = '';

        // Process the stream
        for await (const chunk of stream) {
            // Collect reasoning (thinking) content
            const reasoning = (chunk.choices[0]?.delta as any)?.reasoning_content;
            if (reasoning) {
                reasoningContent += reasoning;
            }

            // Collect actual response content
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                responseContent += content;
            }
        }

        console.log(`LLM call took ${Date.now() - llmStart}ms`);
        if (reasoningContent) {
            console.log('Reasoning:', reasoningContent.substring(0, 200) + '...');
        }

        // Handle empty responses with a fallback
        if (!responseContent || responseContent.trim() === '') {
            console.warn('Empty response from LLM, using fallback');
            const fallback = "Pasensya na po, may technical issue. Pwede po ba ulitin ang tanong niyo?";
            storeMessageAsync(senderId, 'assistant', fallback);
            return fallback;
        }

        // Store bot response (fire and forget)
        storeMessageAsync(senderId, 'assistant', responseContent);

        console.log(`Total response time: ${Date.now() - startTime}ms`);
        return responseContent;
    } catch (error: any) {
        console.error("Error calling NVIDIA API:", error.response?.data || error.message || error);
        return "Pasensya na po, may problema sa connection. Subukan ulit mamaya.";
    }
}
