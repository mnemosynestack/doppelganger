import { X, Globe, Download, Upload, Rocket } from 'lucide-react';
import { useRef } from 'react';
import { Task } from '../types';

interface DashboardScreenProps {
    tasks: Task[];
    onNewTask: () => void;
    onEditTask: (task: Task) => void;
    onDeleteTask: (id: string) => void;
    onExportTasks: () => void;
    onImportTasks: (file: File) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ tasks, onNewTask, onEditTask, onDeleteTask, onExportTasks, onImportTasks }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const getFavicon = (url: string) => {
        try {
            if (!url) return null;
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch (e) {
            return null;
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImportTasks(file);
        }
        event.target.value = '';
    };

    return (
        <div className="flex-1 overflow-hidden animate-in fade-in duration-500">
            <div className="h-full flex flex-col px-12 py-12 max-w-7xl mx-auto space-y-12 w-full">
                <div className="flex items-end justify-between">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.4em]">Status</p>
                        <h2 className="text-4xl font-bold tracking-tighter text-white">Dashboard</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onExportTasks}
                            className="px-4 py-3 rounded-2xl border border-white/10 text-white text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-white/5 transition-all"
                        >
                            <Download className="w-4 h-4 inline-block mr-2" />
                            Export
                        </button>
                        <button
                            onClick={handleImportClick}
                            className="px-4 py-3 rounded-2xl border border-white/10 text-white text-[9px] font-bold uppercase tracking-[0.3em] hover:bg-white/5 transition-all"
                        >
                            <Upload className="w-4 h-4 inline-block mr-2" />
                            Import
                        </button>
                        <button
                            onClick={onNewTask}
                            className="shine-effect bg-white text-black px-8 py-3 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase transition-all hover:scale-105 active:scale-95"
                        >
                            + New Task
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>

                <div className="relative flex-1 min-h-0">
                    <div className="pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#050505] via-[#050505]/50 to-transparent z-10" />
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-12 pr-4 h-full">
                        {tasks.map(task => {
                            const favicon = getFavicon(task.url);
                            return (
                                <div key={task.id} className="glass-card p-8 rounded-[40px] flex flex-col gap-6 group hover:-translate-y-1">
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                            {favicon ? (
                                                <img
                                                    src={favicon}
                                                    alt=""
                                                    className="w-6 h-6 object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <Globe className="w-5 h-5 text-gray-500" />
                                            )}
                                        </div>
                                        <div className="px-3 py-1 rounded-full bg-white/5 text-[7px] font-bold uppercase tracking-widest text-gray-500">{task.mode}</div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white truncate">{task.name || 'Untitled'}</h3>
                                        <p className="text-[10px] text-gray-600 font-mono truncate mt-1">{task.url || 'Target undefined'}</p>
                                    </div>
                                    <div className="flex gap-3 pt-4 border-t border-white/5">
                                        <button
                                            onClick={() => onEditTask(task)}
                                            className="flex-1 py-2 rounded-xl bg-white text-black text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
                                        >
                                            Edit Task
                                        </button>
                                        <button
                                            onClick={() => onDeleteTask(task.id!)}
                                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all"
                                            aria-label="Delete task"
                                            title="Delete task"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {tasks.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <div className="w-24 h-24 border-2 border-dashed border-white/20 rounded-[40px] flex items-center justify-center text-3xl bg-white/5">
                            <Rocket className="w-10 h-10 text-white/50" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-sm font-bold uppercase tracking-widest text-white/70">No Tasks Found</p>
                            <p className="text-[10px] text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                                Get started by creating your first automation task.
                            </p>
                        </div>
                        <button
                            onClick={onNewTask}
                            className="px-6 py-3 bg-white text-black rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase hover:scale-105 transition-transform shadow-lg shadow-white/10"
                        >
                            Create First Task
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardScreen;
