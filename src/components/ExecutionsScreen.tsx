import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Monitor, Cloud } from 'lucide-react';
import { Execution, ConfirmRequest } from '../types';

interface ExecutionsScreenProps {
    onConfirm: (request: string | ConfirmRequest) => Promise<boolean>;
    onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const ExecutionsScreen: React.FC<ExecutionsScreenProps> = ({ onConfirm, onNotify }) => {
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [filter, setFilter] = useState<'all' | 'editor' | 'api'>('all');
    const [loading, setLoading] = useState(false);

    const loadExecutions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/executions');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setExecutions(Array.isArray(data.executions) ? data.executions : []);
        } catch {
            setExecutions([]);
        } finally {
            setLoading(false);
        }
    };

    const clearExecutions = async () => {
        const confirmed = await onConfirm('Clear all executions?');
        if (!confirmed) return;
        const res = await fetch('/api/executions/clear', { method: 'POST' });
        if (res.ok) {
            onNotify('Executions cleared.', 'success');
            loadExecutions();
        } else {
            onNotify('Clear failed.', 'error');
        }
    };

    const deleteExecution = async (id: string) => {
        const confirmed = await onConfirm('Delete this execution?');
        if (!confirmed) return;
        const res = await fetch(`/api/executions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            onNotify('Execution deleted.', 'success');
            setExecutions((prev) => prev.filter((e) => e.id !== id));
        } else {
            onNotify('Delete failed.', 'error');
        }
    };

    useEffect(() => {
        loadExecutions();
    }, []);

    const filtered = executions.filter((exec) => {
        if (filter === 'all') return true;
        return exec.source === filter;
    });

    return (
        <main className="flex-1 p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-end justify-between">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em]">Executions</p>
                        <h2 className="text-4xl font-bold tracking-tighter text-white">Run History</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                            {(['all', 'editor', 'api'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setFilter(mode)}
                                    className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${filter === mode ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={loadExecutions}
                            className="w-10 h-10 rounded-2xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={clearExecutions}
                            className="w-10 h-10 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center"
                            title="Clear all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">Loading executions...</div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">No executions found.</div>
                )}

                <div className="space-y-3">
                    {filtered.map((exec) => (
                        <div key={exec.id} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
                                {exec.source === 'api' ? <Cloud className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-[10px] font-bold text-white uppercase tracking-widest truncate">
                                    {exec.taskName || exec.mode}
                                </div>
                                <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                                    {new Date(exec.timestamp).toLocaleString()} • {exec.source} • {exec.mode} • {exec.status} • {exec.durationMs}ms
                                </div>
                                {exec.url && (
                                    <div className="text-[9px] text-white/50 truncate font-mono">
                                        {exec.url}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => deleteExecution(exec.id)}
                                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
};

export default ExecutionsScreen;
