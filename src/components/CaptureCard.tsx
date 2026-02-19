import React from 'react';
import { ExternalLink, Trash2, Video, Image as ImageIcon } from 'lucide-react';
import { CaptureEntry } from '../types';

interface CaptureCardProps {
    capture: CaptureEntry;
    onDelete?: (name: string) => void;
}

const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CaptureCard: React.FC<CaptureCardProps> = ({ capture, onDelete }) => {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-2 text-[9px] font-bold text-white uppercase tracking-widest">
                    {capture.type === 'recording' ? (
                        <Video className="w-3 h-3 text-blue-400" />
                    ) : (
                        <ImageIcon className="w-3 h-3 text-purple-400" />
                    )}
                    <span className="opacity-80">{capture.type === 'recording' ? 'Recording' : 'Screenshot'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={capture.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        title="Open in new tab"
                        aria-label={`Open ${capture.type} in new tab`}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {onDelete && (
                        <button
                            onClick={() => onDelete(capture.name)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                            title="Delete capture"
                            aria-label={`Delete capture ${capture.name}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="bg-black relative group-hover:brightness-110 transition-all duration-300">
                {capture.type === 'recording' ? (
                    <video src={capture.url} controls className="w-full h-64 object-contain bg-black" />
                ) : (
                    <img
                        src={capture.url}
                        className="w-full h-64 object-contain bg-black"
                        alt={`Screenshot of ${capture.name}`}
                        loading="lazy"
                    />
                )}
            </div>
            <div className="p-3 flex items-center justify-between border-t border-white/5 bg-white/[0.01]">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest truncate max-w-[70%]" title={capture.name}>
                    {capture.name}
                </div>
                {capture.size > 0 && (
                    <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                        {formatSize(capture.size)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaptureCard;
