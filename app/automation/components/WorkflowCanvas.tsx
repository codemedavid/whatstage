'use client';

import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    Panel,
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState, useEffect } from 'react';
import CustomNode from './CustomNode';
import PropertiesPanel from './PropertiesPanel';
import { Plus } from 'lucide-react';

const nodeTypes = {
    custom: CustomNode,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'custom',
        position: { x: 100, y: 100 },
        data: { label: 'Pipeline Stage Changed', description: 'Trigger when lead enters this stage', type: 'trigger' },
    },
];

const initialEdges: Edge[] = [];

interface WorkflowCanvasContentProps {
    onSave?: (workflowData: { nodes: Node[]; edges: Edge[] }) => void;
    isSaving?: boolean;
    initialData?: { nodes: Node[]; edges: Edge[] } | null;
}

function WorkflowCanvasContent({ onSave, isSaving, initialData }: WorkflowCanvasContentProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const { screenToFlowPosition, setCenter } = useReactFlow();

    // Load initial data if provided
    useEffect(() => {
        if (initialData?.nodes && initialData?.edges) {
            setNodes(initialData.nodes);
            setEdges(initialData.edges);
        }
    }, [initialData, setNodes, setEdges]);

    // Auto-save with debounce
    useEffect(() => {
        if (!onSave) return;

        const timer = setTimeout(() => {
            onSave({ nodes, edges });
        }, 2000);

        return () => clearTimeout(timer);
    }, [nodes, edges, onSave]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, eds)),
        [setEdges],
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const updateNodeData = (id: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: newData };
                }
                return node;
            })
        );
        // Keep selected node in sync
        setSelectedNode((prev) => prev ? { ...prev, data: newData } : null);
    };

    const deleteNode = (id: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setSelectedNode(null);
    };

    const addNode = (type: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNode: Node = {
            id,
            type: 'custom',
            position: { x: 250, y: 100 },
            data: {
                label: type === 'condition' ? 'Condition' : 'New Action',
                description: 'Configure this step',
                type
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="h-full w-full relative group">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                className="bg-gray-50"
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
                <Controls className="bg-white border-gray-200 text-gray-700 shadow-sm" />

                <Panel position="top-center" className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                    <button onClick={() => addNode('message')} className="px-3 py-1.5 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors">
                        <Plus size={16} className="text-blue-500" />
                        Message
                    </button>
                    <div className="w-px bg-gray-200 my-1" />
                    <button onClick={() => addNode('wait')} className="px-3 py-1.5 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors">
                        <Plus size={16} className="text-orange-500" />
                        Wait
                    </button>
                    <div className="w-px bg-gray-200 my-1" />
                    <button onClick={() => addNode('smart_condition')} className="px-3 py-1.5 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors">
                        <Plus size={16} className="text-purple-500" />
                        Smart Logic
                    </button>
                    <div className="w-px bg-gray-200 my-1" />
                    <button onClick={() => addNode('stop_bot')} className="px-3 py-1.5 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors">
                        <Plus size={16} className="text-red-500" />
                        Stop Bot
                    </button>
                </Panel>
            </ReactFlow>

            <PropertiesPanel
                selectedNode={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={updateNodeData}
                onDelete={deleteNode}
            />
        </div>
    );
}

export default function WorkflowCanvas(props: WorkflowCanvasContentProps) {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasContent {...props} />
        </ReactFlowProvider>
    );
}
