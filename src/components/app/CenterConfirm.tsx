import { ConfirmRequest } from '../../types';

interface CenterConfirmProps {
    request: ConfirmRequest;
    onResolve: (result: boolean) => void;
}

const CenterConfirm: React.FC<CenterConfirmProps> = ({ request, onResolve }) => {
    return (
        <div className="fixed inset-0 z-[201] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
            <div className="glass-card w-full max-w-md rounded-[32px] border border-white/10 p-8 text-center shadow-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">{request.title ?? 'Confirm'}</p>
                <p className="mt-4 font-mono text-sm text-white">{request.message}</p>
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={() => onResolve(false)}
                        className="w-full rounded-2xl px-6 py-3 text-[9px] font-bold uppercase tracking-[0.3em] transition-all bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        {request.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                        onClick={() => onResolve(true)}
                        className="w-full rounded-2xl px-6 py-3 text-[9px] font-bold uppercase tracking-[0.3em] transition-all bg-white text-black hover:scale-105 shadow-xl shadow-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        {request.confirmLabel ?? 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CenterConfirm;
