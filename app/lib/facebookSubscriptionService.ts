/**
 * Facebook Webhook Subscription Service
 * Handles subscribing and unsubscribing pages to/from webhook events
 */

interface SubscriptionResult {
    success: boolean;
    error?: string;
}

/**
 * Subscribe a Facebook page to receive webhook events
 */
export async function subscribePageWebhook(
    pageId: string,
    pageAccessToken: string
): Promise<SubscriptionResult> {
    try {
        const url = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: pageAccessToken,
                subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_optins'],
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Webhook subscription error:', data.error);
            return {
                success: false,
                error: data.error.message || 'Failed to subscribe webhook',
            };
        }

        console.log(`Successfully subscribed page ${pageId} to webhooks`);
        return { success: true };

    } catch (error) {
        console.error('Webhook subscription error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
}

/**
 * Unsubscribe a Facebook page from webhook events
 */
export async function unsubscribePageWebhook(
    pageId: string,
    pageAccessToken: string
): Promise<SubscriptionResult> {
    try {
        const url = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: pageAccessToken,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Webhook unsubscription error:', data.error);
            return {
                success: false,
                error: data.error.message || 'Failed to unsubscribe webhook',
            };
        }

        console.log(`Successfully unsubscribed page ${pageId} from webhooks`);
        return { success: true };

    } catch (error) {
        console.error('Webhook unsubscription error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
}

/**
 * Check if a page is currently subscribed to webhooks
 */
export async function checkWebhookSubscription(
    pageId: string,
    pageAccessToken: string
): Promise<{ subscribed: boolean; error?: string }> {
    try {
        const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`);
        url.searchParams.set('access_token', pageAccessToken);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.error) {
            return { subscribed: false, error: data.error.message };
        }

        // Check if our app is in the subscribed apps list
        const appId = process.env.FACEBOOK_APP_ID;
        const isSubscribed = data.data?.some((app: { id: string }) => app.id === appId) ?? false;

        return { subscribed: isSubscribed };

    } catch (error) {
        console.error('Check subscription error:', error);
        return {
            subscribed: false,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
}
