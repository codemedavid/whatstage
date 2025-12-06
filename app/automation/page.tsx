'use client';

import WorkflowCanvas from './components/WorkflowCanvas';
import { Play, Edit2, Beaker } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AutomationPageContent() {
    const searchParams = useSearchParams();
    const workflowIdFromUrl = searchParams.get('id');

    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [workflowName, setWorkflowName] = useState('Follow-up Sequence');
    const [isPublished, setIsPublished] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [initialWorkflowData, setInitialWorkflowData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (workflowIdFromUrl) {
            // Load existing workflow
            fetch(`/api/workflows/${workflowIdFromUrl}`)
                .then(res => res.json())
                .then(data => {
                    setWorkflowId(data.id);
                    setWorkflowName(data.name);
                    setIsPublished(data.is_published);
                    setInitialWorkflowData(data.workflow_data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error loading workflow:', err);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [workflowIdFromUrl]);

    const handleSave = async (workflowData: any) => {
        setIsSaving(true);
        try {
            // Extract trigger_stage_id from trigger node
            const triggerNode = workflowData.nodes.find((n: any) => n.data.type === 'trigger');
            const trigger_stage_id = triggerNode?.data?.triggerStageId || null;

            if (workflowId) {
                // Update existing
                await fetch('/api/workflows', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: workflowId,
                        name: workflowName,
                        workflow_data: workflowData,
                        trigger_stage_id
                    }),
                });
            } else {
                // Create new
                const res = await fetch('/api/workflows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: workflowName,
                        workflow_data: workflowData,
                        trigger_stage_id
                    }),
                });
                const data = await res.json();
                setWorkflowId(data.id);
            }
        } catch (error) {
            console.error('Error saving workflow:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!workflowId) {
            alert('Please save the workflow first');
            return;
        }

        try {
            await fetch(`/api/workflows/${workflowId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_published: !isPublished }),
            });
            setIsPublished(!isPublished);
        } catch (error) {
            console.error('Error publishing workflow:', error);
        }
    };

    const handleTestRun = async () => {
        if (!workflowId) {
            alert('Please save the workflow first');
            return;
        }

        // Prompt for test data
        const testLeadId = prompt('Enter test lead ID (from database):');
        const testSenderId = prompt('Enter test sender ID (Facebook PSID):');

        if (!testLeadId || !testSenderId) {
            alert('Both lead ID and sender ID are required');
            return;
        }

        try {
            const res = await fetch('/api/workflows/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId,
                    leadId: testLeadId,
                    senderId: testSenderId
                }),
            });

            const data = await res.json();

            if (res.ok) {
                alert('✅ Workflow execution started! Check the browser console and server logs for details.');
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error testing workflow:', error);
            alert('Failed to test workflow');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    {isEditingName ? (
                        <input
                            type="text"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            onBlur={() => setIsEditingName(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                            className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900">{workflowName}</h1>
                            <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-400 hover:text-gray-600">
                                <Edit2 size={14} />
                            </button>
                        </div>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${isPublished ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleTestRun()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                        <Beaker size={16} />
                        Test Run
                    </button>
                    <button
                        onClick={() => handlePublish()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm ${isPublished
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                    >
                        <Play size={16} />
                        {isPublished ? 'Unpublish' : 'Publish Workflow'}
                    </button>
                </div>
            </header>

            {/* Main Canvas Area */}
            <main className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Loading workflow...
                    </div>
                ) : (
                    <WorkflowCanvas
                        onSave={handleSave}
                        isSaving={isSaving}
                        initialData={initialWorkflowData}
                    />
                )}
            </main>
        </div>
    );
}

export default function AutomationPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>}>
            <AutomationPageContent />
        </Suspense>
    );
}
