'use client';

import { Bell, ChevronRight, FileText, MoreVertical, Download, Share2, PenLine, Maximize2 } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="hover:text-gray-900 cursor-pointer">Knowledge Center</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="hover:text-gray-900 cursor-pointer">Resources</span>
                <ChevronRight size={16} className="text-gray-400" />
                <div className="flex items-center gap-2 text-gray-900 font-medium bg-gray-100 px-2 py-1 rounded">
                    <FileText size={14} className="text-teal-600" />
                    sample.pdf
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-500 border-r border-gray-200 pr-4">
                    <span className="text-xs font-medium">1 / 16</span>
                    <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded">-</button>
                        <span className="text-xs font-medium">100%</span>
                        <button className="p-1 hover:bg-gray-100 rounded">+</button>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-gray-500">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><Maximize2 size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><PenLine size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><Share2 size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><Download size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><MoreVertical size={18} /></button>
                </div>

                <div className="w-px h-6 bg-gray-200 mx-2"></div>

                <button className="p-2 text-gray-500 hover:text-gray-700 relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden border border-gray-200">
                    {/* Placeholder for user avatar */}
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500"></div>
                </div>
            </div>
        </header>
    );
}
