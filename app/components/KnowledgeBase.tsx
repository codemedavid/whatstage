'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, FileText, MoreHorizontal, Folder, FolderPlus, ChevronRight, ChevronDown, Move, Trash2, X, CheckSquare, Square } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  text: string;
  createdAt: string;
  folderId?: string;
}

interface FolderItem {
  id: string;
  name: string;
  isOpen: boolean;
}

interface KnowledgeBaseProps {
  onSelect: (text: string) => void;
}

export default function KnowledgeBase({ onSelect }: KnowledgeBaseProps) {
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; docId: string } | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const fetchKnowledge = async () => {
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      setKnowledge(data);
    } catch (error) {
      console.error('Failed to fetch knowledge:', error);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  useEffect(() => {
    fetchKnowledge();
    fetchFolders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowMoveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      const newFolder = await res.json();
      if (res.ok) {
        setFolders([...folders, newFolder]);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const toggleFolder = (folderId: string) => {
    setFolders(folders.map(f =>
      f.id === folderId ? { ...f, isOpen: !f.isOpen } : f
    ));
  };

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, docId });
  };

  const moveToFolder = async (docId: string, folderId: string | null) => {
    try {
      await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, folderId }),
      });
      setKnowledge(knowledge.map(k =>
        k.id === docId ? { ...k, folderId: folderId || undefined } : k
      ));
    } catch (error) {
      console.error('Failed to move document:', error);
    }
    setContextMenu(null);
    setShowMoveMenu(null);
  };

  const toggleDocSelection = (docId: string) => {
    const newSelection = new Set(selectedDocs);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocs(newSelection);
  };

  const selectAll = () => {
    if (selectedDocs.size === knowledge.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(knowledge.map(k => k.id)));
    }
  };

  const bulkMoveToFolder = async (folderId: string | null) => {
    try {
      // Update all selected documents in the database
      await Promise.all(
        Array.from(selectedDocs).map(id =>
          fetch('/api/knowledge', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, folderId }),
          })
        )
      );
      setKnowledge(knowledge.map(k =>
        selectedDocs.has(k.id) ? { ...k, folderId: folderId || undefined } : k
      ));
    } catch (error) {
      console.error('Failed to move documents:', error);
    }
    setSelectedDocs(new Set());
    setBulkMode(false);
  };

  const deleteDocument = async (docId: string) => {
    try {
      await fetch(`/api/knowledge?id=${docId}`, { method: 'DELETE' });
      setKnowledge(knowledge.filter(k => k.id !== docId));
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const bulkDelete = async () => {
    try {
      // Delete all selected documents
      await Promise.all(
        Array.from(selectedDocs).map(id =>
          fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' })
        )
      );
      setKnowledge(knowledge.filter(k => !selectedDocs.has(k.id)));
      setSelectedDocs(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error('Failed to delete documents:', error);
    }
  };

  const getDocsInFolder = (folderId: string) =>
    knowledge.filter(k => k.folderId === folderId);

  const getUnfiledDocs = () =>
    knowledge.filter(k => !k.folderId);

  const DocItem = ({ item, inFolder = false }: { item: KnowledgeItem; inFolder?: boolean }) => (
    <div
      key={item.id}
      onClick={() => bulkMode ? toggleDocSelection(item.id) : onSelect(item.text)}
      onContextMenu={(e) => handleContextMenu(e, item.id)}
      className={`group flex items-center justify-between px-3 py-2 hover:bg-teal-50 rounded cursor-pointer border border-transparent hover:border-teal-100 ${selectedDocs.has(item.id) ? 'bg-teal-50 border-teal-200' : ''
        }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {bulkMode && (
          <button onClick={(e) => { e.stopPropagation(); toggleDocSelection(item.id); }}>
            {selectedDocs.has(item.id) ? (
              <CheckSquare size={16} className="text-teal-600" />
            ) : (
              <Square size={16} className="text-gray-400" />
            )}
          </button>
        )}
        <FileText size={inFolder ? 14 : 16} className="text-gray-400 group-hover:text-teal-600 flex-shrink-0" />
        <span className="text-sm text-gray-700 truncate">
          {item.text.substring(0, inFolder ? 18 : 20)}{item.text.length > (inFolder ? 18 : 20) ? '...' : ''}
        </span>
      </div>
      {!bulkMode && (
        <button
          onClick={(e) => { e.stopPropagation(); handleContextMenu(e, item.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-teal-100 rounded text-gray-500"
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="w-64 flex flex-col h-full bg-white border-r border-gray-200 flex-shrink-0">
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-700"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {bulkMode && selectedDocs.size > 0 && (
        <div className="p-2 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
          <span className="text-xs text-teal-700 font-medium">{selectedDocs.size} selected</span>
          <div className="flex-1" />
          <select
            onChange={(e) => e.target.value && bulkMoveToFolder(e.target.value === 'unfiled' ? null : e.target.value)}
            className="text-xs border border-teal-200 rounded px-2 py-1 bg-white"
            defaultValue=""
          >
            <option value="" disabled>Move to...</option>
            <option value="unfiled">Unfiled</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={bulkDelete}
            className="p-1 text-red-600 hover:bg-red-100 rounded"
            title="Delete selected"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedDocs(new Set()); }}
              className={`p-1 rounded ${bulkMode ? 'bg-teal-100 text-teal-700' : 'hover:bg-gray-100 text-gray-500'}`}
              title={bulkMode ? 'Exit bulk mode' : 'Bulk select'}
            >
              <CheckSquare size={14} />
            </button>
            <span>Documents</span>
          </div>
          <div className="flex gap-1">
            {bulkMode && (
              <button
                onClick={selectAll}
                className="px-2 py-0.5 text-xs text-teal-600 hover:bg-teal-50 rounded"
              >
                {selectedDocs.size === knowledge.length ? 'Deselect' : 'Select All'}
              </button>
            )}
            <button
              onClick={() => setShowNewFolder(true)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-teal-600"
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
            <button
              onClick={() => onSelect('')}
              className="p-1 hover:bg-gray-100 rounded text-teal-600"
              title="New Document"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {showNewFolder && (
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <button
                onClick={handleCreateFolder}
                className="p-1 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => setShowNewFolder(false)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {/* Folders */}
          {folders.map((folder) => (
            <div key={folder.id}>
              <div
                onClick={() => toggleFolder(folder.id)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded cursor-pointer"
              >
                {folder.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={16} className="text-teal-600" />
                <span className="text-sm flex-1">{folder.name}</span>
                <span className="text-xs text-gray-400">{getDocsInFolder(folder.id).length}</span>
              </div>

              {folder.isOpen && (
                <div className="ml-6 space-y-1">
                  {getDocsInFolder(folder.id).map((item) => (
                    <DocItem key={item.id} item={item} inFolder />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Unfiled Documents */}
          {getUnfiledDocs().map((item) => (
            <DocItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => setShowMoveMenu(contextMenu.docId)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Move size={14} />
            Move to folder
          </button>
          {showMoveMenu === contextMenu.docId && (
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => moveToFolder(contextMenu.docId, null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <FileText size={14} />
                Unfiled
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => moveToFolder(contextMenu.docId, folder.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Folder size={14} className="text-teal-600" />
                  {folder.name}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => deleteDocument(contextMenu.docId)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
