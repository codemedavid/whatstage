'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';

interface Workflow {
    id: string;
    name: string;
    is_published: boolean;
    created_at: string;
    trigger_stage_id: string | null;
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('/api/workflows');
            const data = await res.json();
            setWorkflows(data);
        } catch (error) {
            console.error('Error fetching workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
            setWorkflows(workflows.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting workflow:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Workflows</h1>
                    <p className="text-sm text-gray-500">Automated follow-up sequences</p>
                </div>
                <Link
                    href="/automation"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    Create Workflow
                </Link>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading workflows...</div>
                ) : workflows.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                            <Calendar size={48} className="mx-auto mb-2" />
                            <p className="text-lg font-medium">No workflows yet</p>
                            <p className="text-sm">Create your first automated follow-up sequence</p>
                        </div>
                        <Link
                            href="/automation"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors mt-4"
                        >
                            <Plus size={16} />
                            Create Your First Workflow
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {workflows.map((workflow) => (
                            <div
                                key={workflow.id}
                                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 mb-1">{workflow.name}</h3>
                                        <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${workflow.is_published
                                                ? 'bg-green-50 text-green-600 border border-green-200'
                                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                                                }`}
                                        >
                                            {workflow.is_published ? 'Published' : 'Draft'}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 mb-4">
                                    Created {new Date(workflow.created_at).toLocaleDateString()}
                                </div>

                                <div className="flex gap-2">
                                    <Link
                                        href={`/automation?id=${workflow.id}`}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        <Edit size={14} />
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => deleteWorkflow(workflow.id)}
                                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
