import { useEffect, useState } from 'react';

interface CenterAlertProps {
    message: string;
    tone?: 'success' | 'error';
    onClose: () => void;
}

const CenterAlert: React.FC<CenterAlertProps> = ({ message, tone, onClose }) => {
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        const autoTimer = setTimeout(() => {
            setClosing(true);
        }, 2500);
        return () => clearTimeout(autoTimer);
    }, []);

    useEffect(() => {
        if (!closing) return;
        const closeTimer = setTimeout(() => onClose(), 240);
        return () => clearTimeout(closeTimer);
    }, [closing, onClose]);

    return (
        <div className={`fixed bottom-6 right-6 z-[220] max-w-sm w-full ${closing ? 'animate-out fade-out slide-out-to-bottom-3 duration-200' : 'animate-in fade-in slide-in-from-bottom-3 duration-300'}`}>
            <div
                role={tone === 'error' ? 'alert' : 'status'}
                className={`glass-card rounded-2xl border border-white/10 p-4 shadow-2xl flex items-start gap-3 ${closing ? 'animate-out fade-out zoom-out-95 duration-200' : 'animate-in fade-in zoom-in-95 duration-300'}`}
            >
                <div className={`mt-1 h-2.5 w-2.5 rounded-full ${tone === 'error' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <div className="flex-1">
                    <p className="text-[8px] font-bold uppercase tracking-[0.35em] text-gray-500">Notification</p>
                    <p className="mt-2 font-mono text-[11px] text-white leading-relaxed">{message}</p>
                </div>
                <button
                    onClick={() => setClosing(true)}
                    className="px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                    aria-label="Close notification"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default CenterAlert;
