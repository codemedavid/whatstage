'use client';

import { useState, useEffect, Suspense } from 'react';
import { Save, ArrowLeft, MessageSquare, Facebook, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PageSelector from '@/app/components/PageSelector';

interface ConnectedPage {
    id: string;
    page_id: string;
    page_name: string;
    is_active: boolean;
    webhook_subscribed: boolean;
    profile_pic: string | null;
    created_at: string;
}

interface FacebookPageData {
    id: string;
    name: string;
    access_token: string;
    picture: string | null;
}

function SettingsContent() {
    const searchParams = useSearchParams();

    const [facebookVerifyToken, setFacebookVerifyToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);

    // Facebook OAuth state
    const [showPageSelector, setShowPageSelector] = useState(false);
    const [availablePages, setAvailablePages] = useState<FacebookPageData[]>([]);
    const [connectingPages, setConnectingPages] = useState(false);

    // Handle OAuth callback results
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');
        const facebookPagesParam = searchParams.get('facebook_pages');

        if (error) {
            setMessage(`Error: ${decodeURIComponent(error)}`);
        } else if (success && facebookPagesParam) {
            try {
                const pages = JSON.parse(decodeURIComponent(facebookPagesParam));
                setAvailablePages(pages);
                setShowPageSelector(true);
                // Clear URL params after processing
                window.history.replaceState({}, '', '/settings');
            } catch (e) {
                console.error('Failed to parse pages data:', e);
                setMessage('Failed to process Facebook pages data');
            }
        }
    }, [searchParams]);

    useEffect(() => {
        fetchSettings();
        fetchConnectedPages();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.facebookVerifyToken) setFacebookVerifyToken(data.facebookVerifyToken);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const fetchConnectedPages = async () => {
        setLoadingPages(true);
        try {
            const res = await fetch('/api/facebook/pages');
            const data = await res.json();
            setConnectedPages(data.pages || []);
        } catch (error) {
            console.error('Failed to fetch connected pages:', error);
        } finally {
            setLoadingPages(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facebookVerifyToken,
                }),
            });

            if (res.ok) {
                setMessage('Settings saved successfully!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('Failed to save settings.');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage('An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleFacebookLogin = () => {
        // Redirect to Facebook OAuth
        window.location.href = '/api/auth/facebook/login';
    };

    const handleConnectPages = async (pages: FacebookPageData[]) => {
        setConnectingPages(true);
        const results: string[] = [];

        for (const page of pages) {
            try {
                const res = await fetch('/api/facebook/pages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pageId: page.id,
                        pageName: page.name,
                        pageAccessToken: page.access_token,
                        profilePic: page.picture,
                    }),
                });

                const data = await res.json();
                if (data.success) {
                    results.push(`${page.name}: Connected${data.webhookSubscribed ? ' & subscribed' : ''}`);
                } else {
                    results.push(`${page.name}: ${data.error || 'Failed'}`);
                }
            } catch (error) {
                results.push(`${page.name}: Error connecting`);
            }
        }

        setConnectingPages(false);
        setShowPageSelector(false);
        setAvailablePages([]);
        await fetchConnectedPages();
        setMessage(results.join('. '));
        setTimeout(() => setMessage(''), 5000);
    };

    const handleDisconnectPage = async (pageId: string, pageName: string) => {
        if (!confirm(`Are you sure you want to disconnect "${pageName}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/facebook/pages?pageId=${pageId}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.success) {
                setMessage(`"${pageName}" disconnected successfully`);
                await fetchConnectedPages();
            } else {
                setMessage(`Failed to disconnect: ${data.error}`);
            }
        } catch (error) {
            setMessage('Error disconnecting page');
        }
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            </div>

            {/* Facebook Connection Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Facebook className="text-blue-600" size={24} />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Facebook Pages</h2>
                                <p className="text-sm text-gray-500 mt-1">Connect your Facebook pages to enable messaging</p>
                            </div>
                        </div>
                        <button
                            onClick={handleFacebookLogin}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                        >
                            <Facebook size={18} />
                            Connect with Facebook
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* Connected Pages List */}
                    {loadingPages ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <Loader2 className="animate-spin mr-2" size={20} />
                            Loading connected pages...
                        </div>
                    ) : connectedPages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Facebook size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No pages connected yet</p>
                            <p className="text-sm mt-1">Click &quot;Connect with Facebook&quot; to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {connectedPages.map((page) => (
                                <div
                                    key={page.id}
                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                                >
                                    {/* Page Picture */}
                                    {page.profile_pic ? (
                                        <img
                                            src={page.profile_pic}
                                            alt={page.page_name}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                            <span className="text-lg font-bold text-gray-500">
                                                {page.page_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Page Info */}
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900">{page.page_name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-gray-500">ID: {page.page_id}</span>
                                            {page.webhook_subscribed ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle size={12} />
                                                    Webhook active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                    <AlertCircle size={12} />
                                                    Webhook pending
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Disconnect Button */}
                                    <button
                                        onClick={() => handleDisconnectPage(page.page_id, page.page_name)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Disconnect page"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Webhook Configuration */}
            <form onSubmit={handleSave} className="space-y-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="text-gray-600" size={24} />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Webhook Configuration</h2>
                                <p className="text-sm text-gray-500 mt-1">Configure webhook verification for Facebook</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Verify Token
                            </label>
                            <input
                                type="text"
                                value={facebookVerifyToken}
                                onChange={(e) => setFacebookVerifyToken(e.target.value)}
                                placeholder="Enter your custom verify token (e.g., my_secure_token)"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Use this same token in the Facebook Developer Portal when setting up the Webhook.
                            </p>
                        </div>
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg text-sm ${message.includes('success') || message.includes('Connected') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-teal-300 transition-colors font-medium shadow-sm"
                    >
                        <Save size={18} />
                        {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>

            {/* Page Selector Modal */}
            {showPageSelector && (
                <PageSelector
                    pages={availablePages}
                    onConnect={handleConnectPages}
                    onClose={() => {
                        setShowPageSelector(false);
                        setAvailablePages([]);
                        window.history.replaceState({}, '', '/settings');
                    }}
                />
            )}
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="max-w-4xl mx-auto p-8 flex items-center justify-center">
                <Loader2 className="animate-spin mr-2" size={24} />
                <span>Loading settings...</span>
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
