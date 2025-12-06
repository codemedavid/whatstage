'use client';

import { useState, useEffect } from 'react';
import { Save, ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const [facebookVerifyToken, setFacebookVerifyToken] = useState('');
    const [facebookPageAccessToken, setFacebookPageAccessToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.facebookVerifyToken) setFacebookVerifyToken(data.facebookVerifyToken);
            if (data.facebookPageAccessToken) setFacebookPageAccessToken(data.facebookPageAccessToken);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
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
                    facebookPageAccessToken,
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

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/" className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Facebook Integration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="text-blue-600" size={24} />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Facebook Integration</h2>
                                <p className="text-sm text-gray-500 mt-1">Configure your Facebook Page connection details.</p>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Page Access Token
                            </label>
                            <textarea
                                value={facebookPageAccessToken}
                                onChange={(e) => setFacebookPageAccessToken(e.target.value)}
                                placeholder="Enter your Facebook Page Access Token"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-mono text-sm"
                                rows={4}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Generated from the Facebook Developer Portal for your specific Page.
                            </p>
                        </div>
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
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
                        {loading ? 'Saving...' : 'Save All Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
}
