import { useState, useEffect, useRef } from 'react';
import { Play, Copy, Terminal, X, Check, History as HistoryIcon } from 'lucide-react';
import { Task, TaskMode, ViewMode, VarType, Action, Results, ConfirmRequest } from '../types';
import RichInput from './RichInput';
import CodeEditor from './CodeEditor';
import { SyntaxLanguage } from '../utils/syntaxHighlight';

interface EditorScreenProps {
    currentTask: Task;
    setCurrentTask: (task: Task) => void;
    editorView: ViewMode;
    setEditorView: (view: ViewMode) => void;
    isExecuting: boolean;
    onSave: () => void;
    onRun: () => void;
    results: Results | null;
    saveMsg: string;
    onConfirm: (request: string | ConfirmRequest) => Promise<boolean>;
    onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const VariableRow: React.FC<{
    name: string;
    def: any;
    updateVariable: (oldName: string, name: string, type: VarType, value: any) => void;
    removeVariable: (name: string) => void;
}> = ({ name, def, updateVariable, removeVariable }) => {
    const [localName, setLocalName] = useState(name);

    useEffect(() => {
        setLocalName(name);
    }, [name]);

    return (
        <div className="flex gap-2 items-center">
            <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={() => {
                    if (localName !== name) updateVariable(name, localName, def.type, def.value);
                }}
                className="var-name flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
            />
            <select
                value={def.type}
                onChange={(e) => updateVariable(name, name, e.target.value as VarType, def.value)}
                className="var-type bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-[8px] font-bold uppercase text-white/40"
            >
                <option value="string">STR</option>
                <option value="number">NUM</option>
                <option value="boolean">BOOL</option>
            </select>
            <div className="flex-1">
                {def.type === 'boolean' ? (
                    <select
                        value={String(def.value)}
                        onChange={(e) => updateVariable(name, name, def.type, e.target.value)}
                        className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                    >
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                ) : (
                    <input
                        type={def.type === 'number' ? 'number' : 'text'}
                        value={def.value}
                        onChange={(e) => updateVariable(name, name, def.type, e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                    />
                )}
            </div>
            <button onClick={() => removeVariable(name)} className="p-2 text-red-500 hover:text-red-400">×</button>
        </div>
    );
};

const EditorScreen: React.FC<EditorScreenProps> = ({
    currentTask,
    setCurrentTask,
    editorView,
    setEditorView,
    isExecuting,
    onSave,
    onRun,
    results,
    saveMsg,
    onConfirm,
    onNotify
}) => {
    const [copied, setCopied] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const actionsListRef = useRef<HTMLDivElement | null>(null);
    const [, setActionClipboard] = useState<Action | null>(null);
    const [dragState, setDragState] = useState<{
        id: string;
        startY: number;
        currentY: number;
        height: number;
        index: number;
        originTop: number;
        pointerOffset: number;
    } | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [versions, setVersions] = useState<{ id: string; timestamp: number; name: string; mode: TaskMode }[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);

    const MAX_PREVIEW_CHARS = 60000;
    const MAX_PREVIEW_ITEMS = 200;
    const MAX_PREVIEW_KEYS = 200;
    const MAX_COPY_CHARS = 1000000;
    const MAX_COPY_ITEMS = 2000;
    const MAX_COPY_KEYS = 2000;

    const formatSize = (chars: number) => `${(chars / (1024 * 1024)).toFixed(2)} MB`;

    const clampText = (text: string, limit: number) => {
        if (text.length <= limit) return { text, truncated: false };
        return { text: text.slice(0, limit), truncated: true };
    };

    const getResultsCopyPayload = (payload: Results | null) => {
        if (!payload || payload.data === undefined || payload.data === null) return { reason: 'No data to copy.' };
        return { raw: payload.data };
    };

    const clampWithReason = (text: string, limit: number, reasons: string[]) => {
        if (text.length <= limit) return text;
        reasons.push(`first ${limit.toLocaleString()} chars`);
        return text.slice(0, limit);
    };

    const getTruncatedCopyText = (raw: any) => {
        const reasons: string[] = [];
        if (typeof raw === 'string') {
            const text = clampWithReason(raw, MAX_COPY_CHARS, reasons);
            return { text, truncated: reasons.length > 0, reason: reasons.join(', ') };
        }
        if (Array.isArray(raw)) {
            let snapshot = raw;
            if (raw.length > MAX_COPY_ITEMS) {
                snapshot = raw.slice(0, MAX_COPY_ITEMS);
                reasons.push(`first ${MAX_COPY_ITEMS.toLocaleString()} items`);
            }
            let text = '';
            try {
                text = JSON.stringify(snapshot, null, 2);
            } catch {
                text = String(snapshot);
            }
            text = clampWithReason(text, MAX_COPY_CHARS, reasons);
            return { text, truncated: reasons.length > 0, reason: reasons.join(', ') };
        }
        if (raw && typeof raw === 'object') {
            let snapshot = raw;
            const keys = Object.keys(raw);
            if (keys.length > MAX_COPY_KEYS) {
                snapshot = keys.slice(0, MAX_COPY_KEYS).reduce<Record<string, any>>((acc, key) => {
                    acc[key] = (raw as Record<string, any>)[key];
                    return acc;
                }, {});
                reasons.push(`first ${MAX_COPY_KEYS.toLocaleString()} keys`);
            }
            let text = '';
            try {
                text = JSON.stringify(snapshot, null, 2);
            } catch {
                text = String(snapshot);
            }
            text = clampWithReason(text, MAX_COPY_CHARS, reasons);
            return { text, truncated: reasons.length > 0, reason: reasons.join(', ') };
        }
        const text = clampWithReason(String(raw), MAX_COPY_CHARS, reasons);
        return { text, truncated: reasons.length > 0, reason: reasons.join(', ') };
    };

    const getFullCopyText = (raw: any) => {
        if (typeof raw === 'string') return raw;
        try {
            return JSON.stringify(raw, null, 2);
        } catch {
            return String(raw);
        }
    };

    const getResultsPreview = (payload: Results | null): { text: string; truncated: boolean; language: SyntaxLanguage } => {
        if (!payload || payload.data === undefined || payload.data === null || payload.data === '') {
            return { text: '', truncated: false, language: 'plain' as const };
        }
        const raw = payload.data;
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            const language: SyntaxLanguage = trimmed.startsWith('<') && trimmed.includes('>')
                ? 'html'
                : (trimmed.startsWith('{') || trimmed.startsWith('['))
                    ? 'json'
                    : 'plain';
            const clamped = clampText(raw, MAX_PREVIEW_CHARS);
            return { text: clamped.text, truncated: clamped.truncated, language };
        }
        if (Array.isArray(raw)) {
            const sliced = raw.length > MAX_PREVIEW_ITEMS ? raw.slice(0, MAX_PREVIEW_ITEMS) : raw;
            const text = JSON.stringify(sliced, null, 2);
            const clamped = clampText(text, MAX_PREVIEW_CHARS);
            return { text: clamped.text, truncated: clamped.truncated || raw.length > MAX_PREVIEW_ITEMS, language: 'json' as const };
        }
        if (raw && typeof raw === 'object') {
            const keys = Object.keys(raw);
            let snapshot = raw;
            let truncated = false;
            if (keys.length > MAX_PREVIEW_KEYS) {
                truncated = true;
                snapshot = keys.slice(0, MAX_PREVIEW_KEYS).reduce<Record<string, any>>((acc, key) => {
                    acc[key] = (raw as Record<string, any>)[key];
                    return acc;
                }, {});
            }
            const text = JSON.stringify(snapshot, null, 2);
            const clamped = clampText(text, MAX_PREVIEW_CHARS);
            return { text: clamped.text, truncated: clamped.truncated || truncated, language: 'json' as const };
        }
        const clamped = clampText(String(raw), MAX_PREVIEW_CHARS);
        return { text: clamped.text, truncated: clamped.truncated, language: 'plain' as const };
    };

    const handleCopy = async (text: string, id: string, options?: { skipSizeConfirm?: boolean; truncatedNotice?: boolean }) => {
        if (!text) {
            onNotify('Nothing to copy.', 'error');
            return;
        }
        let copyText = text;
        if (!options?.skipSizeConfirm && text.length > MAX_COPY_CHARS) {
            const confirmed = await onConfirm({
                message: `Copying ${formatSize(text.length)} may freeze your browser.`,
                confirmLabel: 'Copy full',
                cancelLabel: 'Copy segment'
            });
            if (!confirmed) {
                copyText = text.slice(0, MAX_COPY_CHARS);
            }
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(copyText);
            } else {
                // Fallback to execCommand
                const textArea = document.createElement("textarea");
                textArea.value = copyText;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopied(id);
            setTimeout(() => setCopied(null), 2000);
            if (options?.truncatedNotice) {
                onNotify('Copied truncated data.', 'success');
            } else if (copyText.length !== text.length) {
                onNotify('Copied a truncated preview.', 'success');
            }
        } catch (err) {
            console.error('Copy failed:', err);
            onNotify('Copy failed.', 'error');
        }
    };

    const addAction = () => {
        const newAction: Action = {
            id: "act_" + Date.now(),
            type: 'click',
            selector: '',
            value: ''
        };
        setCurrentTask({ ...currentTask, actions: [...currentTask.actions, newAction] });
    };

    const removeAction = (id: string) => {
        setCurrentTask({ ...currentTask, actions: currentTask.actions.filter(a => a.id !== id) });
    };

    const updateAction = (id: string, updates: Partial<Action>) => {
        setCurrentTask({ ...currentTask, actions: currentTask.actions.map(a => a.id === id ? { ...a, ...updates } : a) });
    };

    const moveAction = (fromId: string, toId: string) => {
        if (fromId === toId) return;
        const actions = [...currentTask.actions];
        const fromIndex = actions.findIndex((a) => a.id === fromId);
        const toIndex = actions.findIndex((a) => a.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [moved] = actions.splice(fromIndex, 1);
        actions.splice(toIndex, 0, moved);
        setCurrentTask({ ...currentTask, actions });
    };

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!target || !(target instanceof HTMLElement)) return false;
        return !!target.closest('input, textarea, select, [contenteditable="true"]');
    };

    const getDragIndexFromY = (pointerY: number, activeId: string, snapIndex?: number, snapCenter?: number) => {
        if (snapIndex !== undefined && snapCenter !== undefined) {
            if (Math.abs(pointerY - snapCenter) < 14) {
                return snapIndex;
            }
        }
        const actions = currentTask.actions;
        let nextIndex = actions.length - 1;
        for (let i = 0; i < actions.length; i++) {
            if (actions[i].id === activeId) continue;
            const el = document.getElementById(`action-${actions[i].id}`);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const midpoint = rect.top + rect.height * 0.4;
            if (pointerY < midpoint) {
                nextIndex = i;
                break;
            }
        }
        return nextIndex;
    };

    const finalizeDrag = () => {
        if (!dragState) return;
        if (dragOverIndex !== null && dragOverIndex !== dragState.index) {
            const targetId = currentTask.actions[dragOverIndex]?.id;
            if (targetId) moveAction(dragState.id, targetId);
        }
        setDragState(null);
        setDragOverIndex(null);
        dragPointerIdRef.current = null;
    };

    useEffect(() => {
        if (!dragState) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
            if (actionsListRef.current) {
                const rect = actionsListRef.current.getBoundingClientRect();
                if (e.clientY < rect.top + 28) actionsListRef.current.scrollTop -= 14;
                if (e.clientY > rect.bottom - 28) actionsListRef.current.scrollTop += 14;
            }
            const originCenter = dragState.originTop + dragState.height / 2;
            const nextIndex = getDragIndexFromY(e.clientY, dragState.id, dragState.index, originCenter);
            setDragState((prev) => prev ? { ...prev, currentY: e.clientY } : prev);
            setDragOverIndex(nextIndex);
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
            finalizeDrag();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [dragState, dragOverIndex, currentTask.actions]);

    const addVariable = () => {
        const name = "var_" + Date.now().toString().slice(-4);
        setCurrentTask({ ...currentTask, variables: { ...currentTask.variables, [name]: { type: 'string', value: '' } } });
    };

    const createActionClone = (action: Action) => ({
        ...action,
        id: "act_" + Date.now() + "_" + Math.floor(Math.random() * 1000)
    });

    const openContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        const padding = 8;
        const width = 200;
        const height = 190;
        const x = Math.min(Math.max(e.clientX + 12, padding), window.innerWidth - width - padding);
        const y = Math.min(Math.max(e.clientY + 12, padding), window.innerHeight - height - padding);
        setContextMenu({ id, x, y });
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = (e: Event) => {
            if ((e.target as HTMLElement)?.closest('.action-context-menu')) return;
            setContextMenu(null);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        window.addEventListener('mousedown', handleClick);
        window.addEventListener('keydown', handleKey);
        window.addEventListener('scroll', handleClick, true);
        return () => {
            window.removeEventListener('mousedown', handleClick);
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('scroll', handleClick, true);
        };
    }, [contextMenu]);

    const removeVariable = (name: string) => {
        const next = { ...currentTask.variables };
        delete next[name];
        setCurrentTask({ ...currentTask, variables: next });
    };

    const updateVariable = (oldName: string, name: string, type: VarType, value: any) => {
        const next = { ...currentTask.variables };
        delete next[oldName];
        let processedValue = value;
        if (type === 'number') processedValue = parseFloat(value) || 0;
        if (type === 'boolean') processedValue = value === 'true' || value === true;
        next[name] = { type, value: processedValue };
        setCurrentTask({ ...currentTask, variables: next });
    };

    const loadVersions = async () => {
        if (!currentTask.id) return;
        setVersionsLoading(true);
        try {
            const res = await fetch(`/api/tasks/${currentTask.id}/versions`);
            if (!res.ok) throw new Error('Failed to load versions');
            const data = await res.json();
            setVersions(Array.isArray(data.versions) ? data.versions : []);
        } catch (e) {
            setVersions([]);
        } finally {
            setVersionsLoading(false);
        }
    };

    const rollbackToVersion = async (versionId: string) => {
        if (!currentTask.id) return;
        const confirmed = await onConfirm('Rollback to this version? Current changes will be saved as a new version.');
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/tasks/${currentTask.id}/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId })
            });
            if (!res.ok) throw new Error('Rollback failed');
            const restored = await res.json();
            setCurrentTask(restored);
            onNotify('Rolled back to selected version.', 'success');
            loadVersions();
        } catch (e) {
            onNotify('Rollback failed.', 'error');
        }
    };

    useEffect(() => {
        if (editorView === 'history') loadVersions();
    }, [editorView, currentTask.id]);

    return (
        <div className="flex-1 flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <aside className="w-[460px] glass border-r border-white/10 flex flex-col shrink-0 overflow-hidden">
                <div className="p-8 border-b border-white/10 space-y-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <input
                            type="text"
                            value={currentTask.name}
                            onChange={(e) => setCurrentTask({ ...currentTask, name: e.target.value })}
                            placeholder="Task Name..."
                            className="bg-transparent text-xl font-bold tracking-tight text-white focus:outline-none border-none p-0 w-full placeholder:text-white/10"
                        />
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setEditorView('history')}
                                className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                                title="Task History"
                            >
                                <HistoryIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={onSave}
                                className={`px-4 py-2 text-[9px] font-bold rounded-full uppercase tracking-widest transition-all ${saveMsg === 'SAVED' ? 'text-green-400 border border-green-400/20' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'}`}
                            >
                                {saveMsg === 'SAVED' ? 'SAVED' : 'SAVE'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/5 p-1 rounded-xl flex gap-1 border border-white/5">
                        {(['scrape', 'agent', 'headful'] as TaskMode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setCurrentTask({ ...currentTask, mode: m })}
                                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${currentTask.mode === m ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                {m === 'scrape' ? 'Scraper' : m === 'agent' ? 'Agent' : 'Headful'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Interface Mode</span>
                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
                        {(['visual', 'json', 'api'] as ViewMode[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setEditorView(v)}
                                className={`px-3 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${editorView === v ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 min-h-0 relative">
                    {editorView === 'visual' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Target URL</label>
                                <div className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm focus-within:border-white/30 transition-all">
                                    <RichInput
                                        value={currentTask.url}
                                        onChange={(val) => setCurrentTask({ ...currentTask, url: val })}
                                        variables={currentTask.variables}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Wait (Sec)</label>
                                    <input
                                        type="number"
                                        value={currentTask.wait}
                                        onChange={(e) => setCurrentTask({ ...currentTask, wait: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all text-white"
                                    />
                                </div>
                            </div>

                            <details className="border-t border-white/10 pt-6 font-sans">
                                <summary className="cursor-pointer text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] hover:text-gray-400 transition-all">
                                    Variables (Injectable)
                                </summary>
                                <div className="space-y-3 mt-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[8px] text-gray-600">Dynamic Params</p>
                                        <button onClick={addVariable} className="px-3 py-1 bg-white/5 border border-white/10 text-white text-[8px] font-bold rounded-lg uppercase tracking-widest hover:bg-white/10 transition-all">+ Add</button>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(currentTask.variables).map(([name, def]) => (
                                            <VariableRow
                                                key={name}
                                                name={name}
                                                def={def}
                                                updateVariable={updateVariable}
                                                removeVariable={removeVariable}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </details>

                            <details className="border-t border-white/10 pt-6 font-sans">
                                <summary className="cursor-pointer text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] hover:text-gray-400 transition-all">
                                    Extraction Script
                                </summary>
                                <div className="space-y-3 mt-3">
                                    <p className="text-[8px] text-gray-600">Process scraped HTML with JavaScript. Use <code className="text-blue-400 bg-white/5 px-1 py-0.5 rounded">$$data.html()</code> to access the raw HTML.</p>
                                    <div className="w-full bg-[#050505] border border-white/10 rounded-xl p-4 font-mono text-xs text-green-300 focus-within:border-white/30 resize-none custom-scrollbar leading-relaxed min-h-[200px] whitespace-pre-wrap">
                                        <RichInput
                                            value={currentTask.extractionScript || ''}
                                            onChange={(val) => setCurrentTask({ ...currentTask, extractionScript: val })}
                                            variables={currentTask.variables}
                                            syntax="javascript"
                                            placeholder={`// Example: Extract all links
const html = $$data.html();
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const links = Array.from(doc.querySelectorAll('a')).map(a => a.href);
return JSON.stringify(links, null, 2);`}
                                        />
                                    </div>
                                </div>
                            </details>

                            {currentTask.mode === 'scrape' && (
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Selector Filter</label>
                                    <div className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm focus-within:border-white/30 transition-all">
                                        <RichInput
                                            value={currentTask.selector || ''}
                                            onChange={(val) => setCurrentTask({ ...currentTask, selector: val })}
                                            variables={currentTask.variables}
                                            placeholder=".main-content"
                                        />
                                    </div>
                                </div>
                            )
                            }

                            {
                                currentTask.mode === 'agent' && (
                                    <div className="space-y-6">
                                    <div className="space-y-3" ref={actionsListRef}>
                                        {currentTask.actions.map((action, idx) => {
                                                const isDragging = dragState?.id === action.id;
                                                const isBetween =
                                                    dragState &&
                                                    dragOverIndex !== null &&
                                                    dragState.index !== dragOverIndex &&
                                                    action.id !== dragState.id &&
                                                    ((dragState.index < dragOverIndex && idx > dragState.index && idx <= dragOverIndex) ||
                                                        (dragState.index > dragOverIndex && idx < dragState.index && idx >= dragOverIndex));
                                                const translateY = isBetween ? (dragState?.height || 0) * (dragState.index < (dragOverIndex ?? 0) ? -1 : 1) : 0;
                                                return (
                                                <div
                                                    key={action.id}
                                                    id={`action-${action.id}`}
                                                    onPointerDown={(e) => {
                                                        if (isInteractiveTarget(e.target)) return;
                                                        if (e.button !== 0) return;
                                                        e.preventDefault();
                                                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                                        const pointerOffset = e.clientY - rect.top;
                                                        dragPointerIdRef.current = e.pointerId;
                                                        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                                                        setDragState({
                                                            id: action.id,
                                                            startY: e.clientY,
                                                            currentY: e.clientY,
                                                            height: rect.height,
                                                            index: idx,
                                                            originTop: rect.top,
                                                            pointerOffset
                                                        });
                                                        setDragOverIndex(idx);
                                                    }}
                                                    onPointerUp={(e) => {
                                                        if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
                                                        finalizeDrag();
                                                    }}
                                                    onContextMenu={(e) => openContextMenu(e, action.id)}
                                                    className={`glass-card p-5 rounded-2xl space-y-4 group/item relative transition-[transform,box-shadow,opacity,filter,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform select-none touch-none ${isDragging ? 'ring-2 ring-white/40 scale-[1.02] -translate-y-0.5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] opacity-85 z-20' : ''} ${dragOverIndex === idx && !isDragging ? 'ring-2 ring-blue-400/60 bg-blue-500/5' : ''} ${action.disabled ? 'opacity-40 grayscale' : ''}`}
                                                    style={{
                                                        transform: isDragging
                                                            ? `translateY(${(dragState?.currentY || 0) - (dragState?.pointerOffset || 0) - (dragState?.originTop || 0)}px)`
                                                            : translateY
                                                                ? `translateY(${translateY}px)`
                                                                : undefined
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[8px] font-bold text-white/20 font-mono tracking-tighter">{(idx + 1).toString().padStart(2, '0')}</div>
                                                            <select
                                        value={action.type}
                                        onChange={(e) => updateAction(action.id, { type: e.target.value as any })}
                                        className="action-type-select text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 focus:outline-none cursor-pointer"
                                    >
                                                                <option value="click">Click</option>
                                                                <option value="type">Type</option>
                                                                <option value="hover">Hover</option>
                                                                <option value="press">Press</option>
                                                                <option value="wait">Wait</option>
                                                                <option value="scroll">Scroll</option>
                                                                <option value="javascript">JavaScript</option>
                                                            </select>
                                                        </div>
                                                        <button onClick={() => removeAction(action.id)} className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"><X className="w-4 h-4" /></button>
                                                    </div>
                                                    {(action.type === 'click' || action.type === 'type' || action.type === 'hover') && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Selector</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.selector || ''}
                                                                    onChange={(v) => updateAction(action.id, { selector: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder=".btn-primary"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'scroll' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Selector (Optional)</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.selector || ''}
                                                                    onChange={(v) => updateAction(action.id, { selector: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder=".scroll-container or leave empty"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(action.type === 'type' || action.type === 'wait' || action.type === 'scroll' || action.type === 'javascript') && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">
                                                                {action.type === 'type'
                                                                    ? 'Content'
                                                                    : action.type === 'wait'
                                                                        ? 'Seconds'
                                                                        : action.type === 'scroll'
                                                                            ? 'Pixels'
                                                                            : 'Script'}
                                                            </label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                {action.type === 'javascript' ? (
                                                                    <CodeEditor
                                                                        value={action.value || ''}
                                                                        onChange={(v) => updateAction(action.id, { value: v })}
                                                                        language="javascript"
                                                                        variables={currentTask.variables}
                                                                        className="min-h-[120px]"
                                                                        placeholder="return document.title"
                                                                    />
                                                                ) : (
                                                                    <RichInput
                                                                        value={action.value || ''}
                                                                        onChange={(v) => updateAction(action.id, { value: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder={action.type === 'type' ? 'Search keywords' : action.type === 'wait' ? '3' : '400'}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'press' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Key</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.key || ''}
                                                                    onChange={(v) => updateAction(action.id, { key: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder="Enter"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                            {contextMenu && (() => {
                                                const targetIndex = currentTask.actions.findIndex(a => a.id === contextMenu.id);
                                                const target = currentTask.actions[targetIndex];
                                                if (!target) return null;
                                                return (
                                                    <div
                                                        className="action-context-menu fixed z-50 w-[200px] bg-[#0b0b0b] border border-white/10 rounded-xl shadow-2xl p-2 text-[10px] font-bold uppercase tracking-widest text-white/80"
                                                        style={{ left: contextMenu.x, top: contextMenu.y }}
                                                    >
                                                        <button
                                                            onClick={() => {
                                                                updateAction(target.id, { disabled: !target.disabled });
                                                                closeContextMenu();
                                                            }}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                                                        >
                                                            {target.disabled ? 'Enable' : 'Disable'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                removeAction(target.id);
                                                                closeContextMenu();
                                                            }}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-red-400"
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setActionClipboard(createActionClone(target));
                                                                removeAction(target.id);
                                                                closeContextMenu();
                                                            }}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                                                        >
                                                            Cut
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setActionClipboard(createActionClone(target));
                                                                closeContextMenu();
                                                            }}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                                                        >
                                                            Copy
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const clone = createActionClone(target);
                                                                const next = [...currentTask.actions];
                                                                next.splice(targetIndex + 1, 0, clone);
                                                                setCurrentTask({ ...currentTask, actions: next });
                                                                closeContextMenu();
                                                            }}
                                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                                                        >
                                                            Duplicate
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                            <button
                                                onClick={addAction}
                                                className="w-full py-3 border border-dashed border-white/20 rounded-xl text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all bg-white/[0.02]"
                                            >
                                                + Append Action Seq
                                            </button>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-4">
                                            <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/5 pb-2">Behavior Config</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(currentTask.stealth).map(([key, val]) => (
                                                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={val}
                                                            onChange={(e) => setCurrentTask({
                                                                ...currentTask,
                                                                stealth: { ...currentTask.stealth, [key]: e.target.checked },
                                                                humanTyping: key === 'naturalTyping' ? e.target.checked : currentTask.humanTyping
                                                            })}
                                                            className="w-3 h-3 rounded bg-transparent border-white/20"
                                                        />
                                                        <span className="text-[9px] font-bold text-gray-500 group-hover:text-white transition-all">
                                                            {key.replace(/([A-Z])/g, ' $1').toUpperCase()}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            <div className="pt-4 border-t border-white/10">
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={currentTask.rotateUserAgents}
                                        onChange={(e) => setCurrentTask({ ...currentTask, rotateUserAgents: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Rotate Identity Proxies</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {editorView === 'json' && (
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Protocol JSON</span>
                                <button
                                    onClick={() => { void handleCopy(JSON.stringify(currentTask, null, 2), 'json'); }}
                                    className={`px-4 py-2 border text-[9px] font-bold rounded-xl uppercase transition-all flex items-center gap-2 ${copied === 'json' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                >
                                    {copied === 'json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied === 'json' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <CodeEditor
                                value={JSON.stringify(currentTask, null, 2)}
                                onChange={(val) => {
                                    try {
                                        const parsed = JSON.parse(val);
                                        setCurrentTask(parsed);
                                    } catch (err) { }
                                }}
                                language="json"
                                className="flex-1"
                            />
                        </div>
                    )
                    }

                    {
                        editorView === 'api' && (
                            <div className="h-full flex flex-col">
                                <div className="space-y-6 flex-1 flex flex-col min-h-0">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Deployment Endpoint</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                readOnly
                                                value={currentTask.id ? `${window.location.origin}/tasks/${currentTask.id}/api` : 'Save task to view endpoint'}
                                                className="flex-1 bg-[#050505] border border-white/10 rounded-xl px-4 py-2 font-mono text-xs text-green-300 focus:outline-none"
                                            />
                                            <button
                                                onClick={() => {
                                                    const url = currentTask.id ? `${window.location.origin}/tasks/${currentTask.id}/api` : '';
                                                    if (url) void handleCopy(url, 'endpoint');
                                                }}
                                                className={`px-4 py-2 border text-[9px] font-bold rounded-xl uppercase transition-all flex items-center gap-2 ${copied === 'endpoint' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                            >
                                                {copied === 'endpoint' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copied === 'endpoint' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Override Variables (JSON)</label>
                                            <button onClick={() => {
                                                const cleanVars: Record<string, any> = {};
                                                Object.entries(currentTask.variables).forEach(([n, d]) => cleanVars[n] = d.value);
                                                void handleCopy(JSON.stringify({ variables: cleanVars }, null, 2), 'vars');
                                            }} className={`px-4 py-2 border text-[9px] font-bold rounded-xl uppercase transition-all flex items-center gap-2 ${copied === 'vars' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                                                {copied === 'vars' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copied === 'vars' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <CodeEditor
                                            readOnly
                                            value={(() => {
                                                const cleanVars: Record<string, any> = {};
                                                Object.entries(currentTask.variables).forEach(([n, d]) => cleanVars[n] = d.value);
                                                return JSON.stringify({ variables: cleanVars }, null, 2);
                                            })()}
                                            language="json"
                                            className="flex-1"
                                        />
                                    </div>
                                </div>
                                <p className="text-[8px] text-gray-600 mt-4 font-mono uppercase tracking-widest leading-loose">Automate via HTTP POST to the above endpoint with your API key in the headers.</p>
                            </div>
                        )
                    }
                    {editorView === 'history' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Task Versions</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={loadVersions}
                                        className="px-4 py-2 border border-white/10 text-[9px] font-bold rounded-xl uppercase tracking-widest text-white hover:bg-white/5 transition-all"
                                    >
                                        Refresh
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!currentTask.id) return;
                                            const confirmed = await onConfirm('Clear all task versions?');
                                            if (!confirmed) return;
                                            const res = await fetch(`/api/tasks/${currentTask.id}/versions/clear`, { method: 'POST' });
                                            if (res.ok) {
                                                onNotify('Version history cleared.', 'success');
                                                loadVersions();
                                            } else {
                                                onNotify('Clear failed.', 'error');
                                            }
                                        }}
                                        className="px-4 py-2 border border-red-500/20 text-[9px] font-bold rounded-xl uppercase tracking-widest text-red-300 hover:bg-red-500/10 transition-all"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            {versionsLoading && (
                                <div className="text-[9px] text-gray-500 uppercase tracking-widest">Loading versions...</div>
                            )}
                            {!versionsLoading && versions.length === 0 && (
                                <div className="text-[9px] text-gray-600 uppercase tracking-widest">No versions yet. Save changes to create history.</div>
                            )}
                            <div className="space-y-3">
                                {versions.map((version) => (
                                    <div key={version.id} className="glass-card p-4 rounded-2xl flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-white uppercase tracking-widest">{version.name}</div>
                                            <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                                                {new Date(version.timestamp).toLocaleString()} • {version.mode}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => rollbackToVersion(version.id)}
                                            className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                                        >
                                            Rollback
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div >

                <div className="p-8 border-t border-white/10 backdrop-blur-xl shrink-0">
                    <button
                        onClick={onRun}
                        disabled={isExecuting && currentTask.mode !== 'headful'}
                        className="shine-effect w-full bg-white text-black py-4 rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isExecuting && currentTask.mode !== 'headful' ? (
                            <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : <Play className="w-3 h-3 fill-black" />}
                        <span>
                            {isExecuting && currentTask.mode === 'headful' ? 'Stop Headful' : isExecuting ? 'Running...' : 'Run Task'}
                        </span>
                    </button>
                </div>
            </aside >

            <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#020202] p-12 relative">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                {!results && !isExecuting && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                        <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center">
                            <Terminal className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em]">Ready</p>
                    </div>
                )}

                {(results || isExecuting) && (
                    <div className="space-y-12 relative z-10 max-w-5xl mx-auto">
                        <div className="flex items-end justify-between border-b border-white/5 pb-10">
                            <div className="space-y-4">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em]">Preview</p>
                                <h2 className="text-xl font-mono text-white truncate max-w-xl tracking-tight italic">
                                    {results?.finalUrl || results?.url || currentTask.url}
                                </h2>
                            </div>
                            <div className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] ${isExecuting ? 'bg-blue-500/10 text-blue-400 animate-pulse' : 'bg-green-500/10 text-green-400'}`}>
                                {isExecuting ? 'Running' : 'Finished'}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            <div className="glass-card rounded-[32px] overflow-hidden flex flex-col min-h-[400px]">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                                    <span>Screenshot</span>
                                    <span className="text-white/20">{results?.timestamp || '--:--:--'}</span>
                                </div>
                                <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden">
                                    {results?.screenshotUrl ? (
                                        <img
                                            src={results.screenshotUrl + '?t=' + Date.now()}
                                            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-1000"
                                        />
                                    ) : (
                                        <div className="text-[8px] font-bold text-white/5 uppercase tracking-widest">Waiting for Frame...</div>
                                    )}
                                </div>
                            </div>
                            <div className="glass-card rounded-[32px] p-8 flex flex-col h-[400px]">
                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Activity Log</span>
                                <div className="flex-1 font-mono text-[10px] text-gray-400 space-y-2 overflow-y-auto custom-scrollbar pr-2">
                                    {results?.logs?.map((log: string, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-white/10 shrink-0"></span> <span>{log}</span>
                                        </div>
                                    ))}
                                    {isExecuting && (!results?.logs || results?.logs.length === 0) && <div className="animate-pulse">Connecting to kernel...</div>}
                                </div>
                            </div>
                        </div>

                        <div className="glass-card rounded-[32px] p-8 flex flex-col">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Data</span>
                                <button
                                    onClick={async () => {
                                        const payload = getResultsCopyPayload(results);
                                        if (payload.reason) {
                                            onNotify(payload.reason || 'Data too large to copy safely.', 'error');
                                            return;
                                        }
                                        const preview = getResultsPreview(results);
                                        const fullText = getFullCopyText(payload.raw);
                                        let copyText = fullText;
                                        let usedTruncated = false;

                                        if (preview.truncated) {
                                            const confirmed = await onConfirm({
                                                message: 'Preview is truncated for performance.',
                                                confirmLabel: 'Copy full',
                                                cancelLabel: 'Copy preview'
                                            });
                                            if (!confirmed) {
                                                copyText = preview.text || '';
                                                usedTruncated = true;
                                            }
                                        }

                                        if (copyText.length > MAX_COPY_CHARS) {
                                            const proceed = await onConfirm({
                                                message: `Copying ${formatSize(copyText.length)} may freeze your browser.`,
                                                confirmLabel: 'Copy full',
                                                cancelLabel: usedTruncated ? 'Copy preview' : 'Copy truncated'
                                            });
                                            if (!proceed) {
                                                const truncated = getTruncatedCopyText(payload.raw);
                                                copyText = truncated.text;
                                                usedTruncated = true;
                                            }
                                        }

                                        void handleCopy(copyText, 'data', { skipSizeConfirm: true, truncatedNotice: usedTruncated });
                                    }}
                                    className={`px-3 py-2 border text-[9px] font-bold rounded-xl uppercase transition-all flex items-center gap-2 ${copied === 'data' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                    title="Copy extracted data"
                                >
                                    {copied === 'data' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied === 'data' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {(() => {
                                    if (isExecuting && (!results || results.data === undefined)) {
                                        return <pre className="font-mono text-[10px] text-blue-300/60 whitespace-pre-wrap leading-relaxed">Buffering data stream...</pre>;
                                    }
                                    if (!results || results.data === undefined || results.data === null || results.data === '') {
                                        return <pre className="font-mono text-[10px] text-blue-300/60 whitespace-pre-wrap leading-relaxed">No intelligence gathered.</pre>;
                                    }
                                    const preview = getResultsPreview(results);
                                    return (
                                        <div className="space-y-2">
                                            {preview.truncated && (
                                                <div className="text-[8px] text-amber-300/80 uppercase tracking-widest">
                                                    Preview truncated for performance.
                                                </div>
                                            )}
                                            <CodeEditor readOnly value={preview.text} language={preview.language} />
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div >
    );
};

export default EditorScreen;
