'use client';

import { X, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Node } from '@xyflow/react';

interface PropertiesPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdate: (id: string, data: any) => void;
    onDelete: (id: string) => void;
}

export default function PropertiesPanel({ selectedNode, onClose, onUpdate, onDelete }: PropertiesPanelProps) {
    const [stages, setStages] = useState<Array<{ id: string; name: string }>>([]);

    useEffect(() => {
        // Fetch pipeline stages
        fetch('/api/pipeline/stages')
            .then(res => res.json())
            .then(data => {
                // Ensure data is an array
                if (Array.isArray(data)) {
                    setStages(data);
                } else {
                    console.error('Stages API did not return an array:', data);
                    setStages([]);
                }
            })
            .catch(err => {
                console.error('Error fetching stages:', err);
                setStages([]);
            });
    }, []);

    if (!selectedNode) return null;

    // Helper to update a specific field immediately
    const updateField = (field: string, value: any) => {
        if (!selectedNode) return;

        onUpdate(selectedNode.id, {
            ...selectedNode.data,
            [field]: value
        });
    };

    // Helper to get value with safe default
    const getValue = (field: string, defaultValue: any = '') => {
        return (selectedNode.data[field] as any) ?? defaultValue;
    };

    return (
        <div className="absolute top-4 right-4 w-80 bg-white shadow-xl rounded-xl border border-gray-100 flex flex-col overflow-hidden z-10 animate-in slide-in-from-right-10 duration-200" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-semibold text-gray-800">Properties</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onDelete(selectedNode.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Node"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium capitalize text-gray-700">
                        {selectedNode.data.type as string}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                    <input
                        type="text"
                        value={getValue('label')}
                        onChange={(e) => updateField('label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <textarea
                        value={getValue('description')}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                </div>

                <div className="h-px bg-gray-100 my-2" />

                {/* Specific Fields */}

                {selectedNode.data.type === 'message' && (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Message Mode</label>
                            <select
                                value={getValue('messageMode', 'custom')}
                                onChange={(e) => updateField('messageMode', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                                <option value="custom">Custom Message</option>
                                <option value="ai">AI-Generated</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                {getValue('messageMode') === 'ai' ? 'Message Prompt' : 'Message Text'}
                            </label>
                            <textarea
                                value={getValue('messageText')}
                                onChange={(e) => updateField('messageText', e.target.value)}
                                rows={4}
                                placeholder={getValue('messageMode') === 'ai' ? 'Describe what the message should say...' : 'Type your message here...'}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                {getValue('messageMode') === 'ai'
                                    ? 'AI will generate a personalized message based on conversation context'
                                    : 'This exact message will be sent to the customer'}
                            </p>
                        </div>
                    </div>
                )}

                {selectedNode.data.type === 'trigger' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Pipeline Stage Trigger</label>
                            <select
                                value={getValue('triggerStageId')}
                                onChange={(e) => updateField('triggerStageId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                                <option value="">Select a stage...</option>
                                {Array.isArray(stages) && stages.map((stage) => (
                                    <option key={stage.id} value={stage.id}>
                                        {stage.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                                Workflow triggers when a lead enters this stage
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-amber-800">Apply to existing leads</label>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        When published, also run for leads already in this stage
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateField('applyToExisting', !getValue('applyToExisting', false))}
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${getValue('applyToExisting', false) ? 'bg-amber-500' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${getValue('applyToExisting', false) ? 'translate-x-4' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedNode.data.type === 'wait' && (
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                            <input
                                type="number"
                                value={getValue('duration', '5')}
                                onChange={(e) => updateField('duration', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="5"
                                min="1"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                            <select
                                value={getValue('unit', 'minutes')}
                                onChange={(e) => updateField('unit', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                            </select>
                        </div>
                    </div>
                )}

                {selectedNode.data.type === 'stop_bot' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Reason (Optional)</label>
                        <input
                            type="text"
                            value={getValue('reason')}
                            onChange={(e) => updateField('reason', e.target.value)}
                            placeholder="e.g. User opted out"
                            className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                )}

                {selectedNode.data.type === 'smart_condition' && (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Condition Type</label>
                            <select
                                value={getValue('conditionType', 'has_replied')}
                                onChange={(e) => updateField('conditionType', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                                <option value="has_replied">User Has Replied?</option>
                                <option value="ai_rule">Custom AI Rule</option>
                            </select>
                        </div>
                        {getValue('conditionType') === 'ai_rule' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Rule Detail</label>
                                <textarea
                                    value={getValue('conditionRule')}
                                    onChange={(e) => updateField('conditionRule', e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Check if user is interested"
                                    className="w-full px-3 py-2 border border-gray-200 text-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
