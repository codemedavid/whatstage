'use client';

import { useState, useEffect } from 'react';
import { Save, Bot, Plus, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';

interface Rule {
    id: string;
    rule: string;
    category: string;
    priority: number;
    enabled: boolean;
}

export default function RulesEditor() {
    const [botName, setBotName] = useState('');
    const [botTone, setBotTone] = useState('');
    const [instructions, setInstructions] = useState('');
    const [rules, setRules] = useState<Rule[]>([]);
    const [newRule, setNewRule] = useState('');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchRules();
        fetchInstructions();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.botName) setBotName(data.botName);
            if (data.botTone) setBotTone(data.botTone);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/rules');
            const data = await res.json();
            setRules(data.rules || []);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        }
    };

    const fetchInstructions = async () => {
        try {
            const res = await fetch('/api/instructions');
            const data = await res.json();
            setInstructions(data.instructions || '');
        } catch (error) {
            console.error('Failed to fetch instructions:', error);
        }
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botName, botTone }),
                }),
                fetch('/api/instructions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instructions }),
                }),
            ]);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = async () => {
        if (!newRule.trim()) return;
        try {
            const res = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule: newRule, priority: rules.length }),
            });
            const data = await res.json();
            if (data.success) {
                setRules([...rules, data.rule]);
                setNewRule('');
            }
        } catch (error) {
            console.error('Failed to add rule:', error);
        }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
            setRules(rules.filter(r => r.id !== id));
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const handleToggleRule = async (id: string, enabled: boolean) => {
        try {
            await fetch('/api/rules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, enabled: !enabled }),
            });
            setRules(rules.map(r => r.id === id ? { ...r, enabled: !enabled } : r));
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    };

    return (
        <div className="flex-1 bg-gray-100 flex flex-col h-full overflow-hidden">
            <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Bot className="text-teal-600" size={18} />
                    <span className="font-medium text-gray-700">Bot Configuration</span>
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${saved
                        ? 'bg-green-600 text-white'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                >
                    <Save size={16} />
                    {saved ? 'Saved!' : loading ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                <div className="w-full max-w-[900px] space-y-6">
                    {/* Bot Identity */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Bot Identity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Bot Name</label>
                                <input
                                    type="text"
                                    value={botName}
                                    onChange={(e) => setBotName(e.target.value)}
                                    placeholder="e.g., WebNegosyo Assistant"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Tone & Personality</label>
                                <input
                                    type="text"
                                    value={botTone}
                                    onChange={(e) => setBotTone(e.target.value)}
                                    placeholder="e.g., Friendly, professional"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Conversation Style Instructions */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-800 mb-2">Conversation Style Instructions</h3>
                        <p className="text-sm text-gray-500 mb-4">Control how the bot converses - tone, what to avoid, examples of good/bad responses</p>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="E.g., Talk like a real Filipino salesperson texting, not a script. NO multiple choice questions...)"
                            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800 font-mono text-sm"
                            rows={12}
                        />
                    </div>

                    {/* Rules Table */}
                    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800">Bot Rules</h3>
                            <span className="text-sm text-gray-500">{rules.filter(r => r.enabled).length} active rules</span>
                        </div>

                        {/* Add New Rule */}
                        <div className="p-4 border-b border-gray-100 flex gap-2">
                            <input
                                type="text"
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                placeholder="Add a new rule... (e.g., Always greet customers warmly)"
                                className="flex-1 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                            />
                            <button
                                onClick={handleAddRule}
                                className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Add Rule
                            </button>
                        </div>

                        {/* Rules List */}
                        <div className="divide-y divide-gray-100">
                            {rules.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No rules added yet. Add rules above to control your bot&apos;s behavior.
                                </div>
                            ) : (
                                rules.map((rule, index) => (
                                    <div
                                        key={rule.id}
                                        className={`flex items-center gap-3 p-4 hover:bg-gray-50 ${!rule.enabled ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <GripVertical size={16} className="text-gray-400 cursor-grab" />
                                        <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                                        <p className="flex-1 text-gray-700">{rule.rule}</p>
                                        <button
                                            onClick={() => handleToggleRule(rule.id, rule.enabled)}
                                            className={`p-1 rounded ${rule.enabled ? 'text-teal-600' : 'text-gray-400'}`}
                                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                        >
                                            {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 text-center">
                        The bot will check these rules before every response. Disabled rules are ignored.
                    </p>
                </div>
            </div>
        </div>
    );
}
