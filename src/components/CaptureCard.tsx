import React from 'react';
import { CaptureEntry } from '../types';

interface CaptureCardProps {
    capture: CaptureEntry;
    onDelete?: (name: string) => void;
}

const CaptureCard: React.FC<CaptureCardProps> = ({ capture, onDelete }) => {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <div className="text-[9px] font-bold text-white uppercase tracking-widest">
                    {capture.type === 'recording' ? 'Recording' : 'Screenshot'}
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={capture.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] font-bold uppercase tracking-widest text-blue-300 hover:text-blue-200 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        Open
                    </a>
                    {onDelete && (
                        <button
                            onClick={() => onDelete(capture.name)}
                            className="text-[9px] font-bold uppercase tracking-widest text-red-300 hover:text-red-200 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
            <div className="bg-black">
                {capture.type === 'recording' ? (
                    <video src={capture.url} controls className="w-full h-64 object-contain bg-black" />
                ) : (
                    <img src={capture.url} className="w-full h-64 object-contain bg-black" alt={`Screenshot of ${capture.name}`} />
                )}
            </div>
            <div className="p-3 text-[9px] text-gray-500 uppercase tracking-widest">
                {capture.name}
            </div>
        </div>
    );
};

export default CaptureCard;
