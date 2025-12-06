'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

interface FacebookPageData {
    id: string;
    name: string;
    access_token: string;
    picture: string | null;
}

interface PageSelectorProps {
    pages: FacebookPageData[];
    onConnect: (pages: FacebookPageData[]) => Promise<void>;
    onClose: () => void;
}

export default function PageSelector({ pages, onConnect, onClose }: PageSelectorProps) {
    const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const togglePage = (pageId: string) => {
        const newSelected = new Set(selectedPages);
        if (newSelected.has(pageId)) {
            newSelected.delete(pageId);
        } else {
            newSelected.add(pageId);
        }
        setSelectedPages(newSelected);
    };

    const handleConnect = async () => {
        if (selectedPages.size === 0) {
            setError('Please select at least one page');
            return;
        }

        setConnecting(true);
        setError(null);

        try {
            const pagesToConnect = pages.filter(p => selectedPages.has(p.id));
            await onConnect(pagesToConnect);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect pages');
        } finally {
            setConnecting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Select Pages to Connect</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Choose which Facebook pages you want to manage
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Page List */}
                <div className="p-4 max-h-[50vh] overflow-y-auto">
                    {pages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No pages found.</p>
                            <p className="text-sm mt-2">Make sure you have admin access to at least one Facebook page.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pages.map((page) => (
                                <button
                                    key={page.id}
                                    onClick={() => togglePage(page.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${selectedPages.has(page.id)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    {/* Page Picture */}
                                    <div className="flex-shrink-0">
                                        {page.picture ? (
                                            <img
                                                src={page.picture}
                                                alt={page.name}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-lg font-bold text-gray-500">
                                                    {page.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Page Info */}
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold text-gray-900">{page.name}</p>
                                        <p className="text-sm text-gray-500">ID: {page.id}</p>
                                    </div>

                                    {/* Checkbox */}
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedPages.has(page.id)
                                            ? 'border-blue-500 bg-blue-500'
                                            : 'border-gray-300'
                                        }`}>
                                        {selectedPages.has(page.id) && (
                                            <Check size={14} className="text-white" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="px-4">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={connecting || selectedPages.size === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors font-medium flex items-center gap-2"
                    >
                        {connecting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Connect {selectedPages.size > 0 ? `(${selectedPages.size})` : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
