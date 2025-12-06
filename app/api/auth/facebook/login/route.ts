import { NextResponse } from 'next/server';

// Facebook OAuth configuration
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/facebook/callback`
    : 'http://localhost:3000/api/auth/facebook/callback';

// Required permissions for page messaging
const SCOPES = [
    'pages_messaging',           // Send and receive messages
    'pages_manage_metadata',     // Subscribe to webhooks
    'pages_read_engagement',     // Read page data
    'pages_show_list',           // List user's pages
].join(',');

export async function GET() {
    if (!FACEBOOK_APP_ID) {
        return NextResponse.json(
            { error: 'Facebook App ID not configured' },
            { status: 500 }
        );
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);

    // Build Facebook OAuth URL
    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    // Redirect to Facebook OAuth dialog
    return NextResponse.redirect(authUrl.toString());
}
