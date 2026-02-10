import { useState, useEffect, useRef } from 'react';
import {
    Play,
    Copy,
    X,
    Check,
    History as HistoryIcon,
    MousePointer2,
    Type as TypeIcon,
    Target,
    Keyboard,
    Clock,
    ArrowDownUp,
    Code,
    Split,
    CornerRightDown,
    Repeat,
    List,
    Variable,
    Layers,
    Square,
    AlertTriangle,
    PlayCircle,
    Table,
    Camera
} from 'lucide-react';
import { Task, TaskMode, ViewMode, VarType, Action, Results, ConfirmRequest } from '../types';
import RichInput from './RichInput';
import CodeEditor from './CodeEditor';
import { ACTION_CATALOG } from './editor/actionCatalog';
import ActionPalette from './editor/ActionPalette';
import JsonEditorPane from './editor/JsonEditorPane';
import ResultsPane from './editor/ResultsPane';

const PRESS_MODIFIERS = [
    { value: 'Control', label: 'Ctrl' },
    { value: 'Shift', label: 'Shift' },
    { value: 'Alt', label: 'Alt' },
    { value: 'Meta', label: 'Meta' }
];

const PRESS_BASE_KEYS = [
    'Enter',
    'Tab',
    'Escape',
    'Space',
    'Backspace',
    'Delete',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'F1',
    'F2',
    'F3',
    'F4',
    'F5'
]
    .concat([...Array(10)].map((_, i) => `${i}`))
    .concat(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)));

const TYPE_MODE_OPTIONS = [
    { value: 'replace', label: 'Replace Text' },
    { value: 'append', label: 'Append Text' }
];

const parsePressKey = (key?: string) => {
    if (!key) return { modifiers: [] as string[], baseKey: '' };
    const parts = key.split('+');
    const baseKey = parts.pop() || '';
    return { modifiers: parts, baseKey };
};

const buildPressKey = (modifiers: string[], baseKey: string) => {
    const filtered = modifiers.filter(Boolean);
    return [ ...filtered, baseKey ].filter(Boolean).join('+');
};

interface EditorScreenProps {
    currentTask: Task;
    setCurrentTask: (task: Task) => void;
    tasks?: Task[];
    editorView: ViewMode;
    setEditorView: (view: ViewMode) => void;
    isExecuting: boolean;
    onSave: () => void;
    onRun: () => void;
    results: Results | null;
    pinnedResults?: Results | null;
    saveMsg: string;
    onConfirm: (request: string | ConfirmRequest) => Promise<boolean>;
    onNotify: (message: string, tone?: 'success' | 'error') => void;
    onPinResults?: (results: Results) => void;
    onUnpinResults?: () => void;
    onRunSnapshot?: (task: Task) => void;
    runId?: string | null;
    onStop?: () => void;
    hasUnsavedChanges: boolean;
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
                className="custom-select var-type bg-white/[0.05] border border-white/10 rounded-xl px-2 py-2 text-[8px] font-bold uppercase text-white/40"
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
                        className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white"
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
            <button
                onClick={() => removeVariable(name)}
                className="p-2 text-red-500 hover:text-red-400 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                aria-label={`Remove variable ${name}`}
                title="Remove variable"
            >×</button>
        </div>
    );
};

const EditorScreen: React.FC<EditorScreenProps> = ({
    currentTask,
    setCurrentTask,
    tasks = [],
    editorView,
    setEditorView,
    isExecuting,
    onSave,
    onRun,
    results,
    pinnedResults,
    saveMsg,
    onConfirm,
    onNotify,
    onPinResults,
    onUnpinResults,
    onRunSnapshot,
    runId,
    onStop,
    hasUnsavedChanges
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
    const [actionPaletteOpen, setActionPaletteOpen] = useState(false);
    const [actionPaletteQuery, setActionPaletteQuery] = useState('');
    const [actionPaletteTargetId, setActionPaletteTargetId] = useState<string | null>(null);
    const [versionPreview, setVersionPreview] = useState<{ id: string; timestamp: number; snapshot: Task } | null>(null);
    const [versionPreviewLoading, setVersionPreviewLoading] = useState(false);
    const [actionStatusById, setActionStatusById] = useState<Record<string, 'running' | 'success' | 'error' | 'skipped'>>({});
    const [proxyList, setProxyList] = useState<{ id: string }[]>([]);
    const [proxyListLoaded, setProxyListLoaded] = useState(false);
    const getStoredSplitPercent = () => {
        try {
            const stored = localStorage.getItem('doppelganger.layout.leftWidthPct');
            if (!stored) return 0.3;
            const value = parseFloat(stored);
            if (Number.isNaN(value)) return 0.3;
            return Math.min(0.75, Math.max(0.25, value));
        } catch {
            return 0.3;
        }
    };

    const clampEditorWidth = (value: number) => {
        const minWidth = 320;
        const maxWidth = Math.floor(window.innerWidth * 0.8);
        return Math.max(minWidth, Math.min(maxWidth, value));
    };

    const [editorWidth, setEditorWidth] = useState(() => {
        if (typeof window === 'undefined') return 360;
        const pct = getStoredSplitPercent();
        return clampEditorWidth(Math.round(window.innerWidth * pct));
    });
    const resizingRef = useRef(false);
    const availableTasks = tasks.filter((task) => String(task.id || '') !== String(currentTask.id || ''));
    const rotateProxiesDisabled = proxyListLoaded && proxyList.length === 1 && proxyList[0]?.id === 'host';

    const MAX_COPY_CHARS = 1000000;

    const formatSize = (chars: number) => `${(chars / (1024 * 1024)).toFixed(2)} MB`;

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

    useEffect(() => {
        let cancelled = false;
        const loadProxies = async () => {
            try {
                const res = await fetch('/api/settings/proxies', { credentials: 'include' });
                if (!res.ok) throw new Error('Failed to load proxies');
                const data = await res.json();
                if (cancelled) return;
                setProxyList(Array.isArray(data.proxies) ? data.proxies : []);
            } catch {
                if (!cancelled) setProxyList([]);
            } finally {
                if (!cancelled) setProxyListLoaded(true);
            }
        };
        loadProxies();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (rotateProxiesDisabled && currentTask.rotateProxies) {
            setCurrentTask({ ...currentTask, rotateProxies: false });
        }
    }, [rotateProxiesDisabled, currentTask, setCurrentTask]);

    const blockStartTypes = new Set(['if', 'while', 'repeat', 'foreach', 'on_error']);
    const normalizeVarName = (raw: string) => {
        const trimmed = (raw || '').trim();
        const match = trimmed.match(/^\{\$([\w.]+)\}$/);
        return match ? match[1] : trimmed;
    };
    const conditionOps = {
        string: [
            { value: 'equals', label: 'Equals' },
            { value: 'not_equals', label: 'Not equal' },
            { value: 'contains', label: 'Contains' },
            { value: 'starts_with', label: 'Starts with' },
            { value: 'ends_with', label: 'Ends with' },
            { value: 'matches', label: 'Matches regex' }
        ],
        number: [
            { value: 'equals', label: 'Equals' },
            { value: 'not_equals', label: 'Not equal' },
            { value: 'gt', label: 'Greater than' },
            { value: 'gte', label: 'Greater or equal' },
            { value: 'lt', label: 'Less than' },
            { value: 'lte', label: 'Less or equal' }
        ],
        boolean: [
            { value: 'is_true', label: 'Is true' },
            { value: 'is_false', label: 'Is false' }
        ]
    };

    const getBlockDepths = (actions: Action[]) => {
        let depth = 0;
        return actions.map((action) => {
            if (action.type === 'else' || action.type === 'end') {
                depth = Math.max(0, depth - 1);
            }
            const currentDepth = depth;
            if (action.type === 'else' || blockStartTypes.has(action.type)) {
                depth += 1;
            }
            return currentDepth;
        });
    };

    const addActionByType = (type: Action['type']) => {
        const base: Action = {
            id: "act_" + Date.now(),
            type,
            selector: '',
            value: ''
        };
        if (type === 'set') base.varName = '';
        if (type === 'merge') base.varName = '';
        if (type === 'start') base.value = '';
        if (type === 'type') base.typeMode = 'replace';
        if (type === 'if') {
            base.conditionVar = '';
            base.conditionVarType = 'string';
            base.conditionOp = 'equals';
            base.conditionValue = '';
        }
        if (type === 'while') {
            base.conditionVar = '';
            base.conditionVarType = 'string';
            base.conditionOp = 'equals';
            base.conditionValue = '';
        }
        setCurrentTask({ ...currentTask, actions: [...currentTask.actions, base] });
    };

    const openActionPalette = (targetId?: string) => {
        setActionPaletteOpen(true);
        setActionPaletteQuery('');
        setActionPaletteTargetId(targetId || null);
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
        return !!target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-drag="true"]');
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

    useEffect(() => {
        if (!runId || currentTask.mode !== 'agent') return;
        setActionStatusById({});
        const source = new EventSource(`/api/executions/stream?runId=${encodeURIComponent(runId)}`, { withCredentials: true });
        source.onmessage = (event) => {
            if (!event.data) return;
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.actionId && payload.status) {
                    setActionStatusById((prev) => ({ ...prev, [payload.actionId]: payload.status }));
                }
            } catch {
                // ignore
            }
        };
        source.addEventListener('ready', () => {
            // stream is alive
        });
        source.onopen = () => {
            // connected
        };
        source.onerror = () => {
            // avoid keeping a dead connection open
            source.close();
        };
        return () => {
            source.close();
        };
    }, [runId, currentTask.mode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const pct = getStoredSplitPercent();
        setEditorWidth(clampEditorWidth(Math.round(window.innerWidth * pct)));
    }, []);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!resizingRef.current) return;
            const next = clampEditorWidth(event.clientX);
            setEditorWidth(next);
        };

        const handlePointerUp = () => {
            resizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, []);


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

    const openVersionPreview = async (versionId: string) => {
        if (!currentTask.id) return;
        setVersionPreviewLoading(true);
        try {
            const res = await fetch(`/api/tasks/${currentTask.id}/versions/${versionId}`);
            if (!res.ok) throw new Error('Failed to load version');
            const data = await res.json();
            if (!data?.snapshot) throw new Error('Missing snapshot');
            setVersionPreview({
                id: data.metadata?.id || versionId,
                timestamp: data.metadata?.timestamp || Date.now(),
                snapshot: data.snapshot
            });
        } catch {
            onNotify('Failed to load version snapshot.', 'error');
        } finally {
            setVersionPreviewLoading(false);
        }
    };

    useEffect(() => {
        if (editorView === 'history') loadVersions();
    }, [editorView, currentTask.id]);

    return (
        <div className="flex-1 flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <aside className="glass border-r border-white/10 flex flex-col shrink-0 overflow-hidden" style={{ width: editorWidth }}>
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
                                disabled={!hasUnsavedChanges}
                                className={`px-4 py-2 text-[9px] font-bold rounded-full uppercase tracking-widest transition-all ${saveMsg === 'SAVED' ? 'text-green-400 border border-green-400/20' : 'bg-blue-500/10 border border-white/10 text-blue-400'} ${hasUnsavedChanges ? 'hover:bg-blue-500/20' : 'opacity-50 cursor-not-allowed'}`}
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

                <div
                    className={`flex-1 p-8 min-h-0 relative ${editorView === 'json' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} ${editorView === 'visual' ? 'space-y-8' : ''}`}
                >
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

                            {currentTask.mode === 'agent' && (
                                    <div className="space-y-6 order-1">
                                    <div className="space-y-3" ref={actionsListRef}>
                                        {(() => {
                                            const blockDepths = getBlockDepths(currentTask.actions);
                                            return currentTask.actions.map((action, idx) => {
                                                const isDragging = dragState?.id === action.id;
                                                const isBetween =
                                                    dragState &&
                                                    dragOverIndex !== null &&
                                                    dragState.index !== dragOverIndex &&
                                                    action.id !== dragState.id &&
                                                    ((dragState.index < dragOverIndex && idx > dragState.index && idx <= dragOverIndex) ||
                                                        (dragState.index > dragOverIndex && idx < dragState.index && idx >= dragOverIndex));
                                                const translateY = isBetween ? (dragState?.height || 0) * (dragState.index < (dragOverIndex ?? 0) ? -1 : 1) : 0;
                                                const depth = blockDepths[idx] || 0;
                                                const status = action.disabled ? 'skipped' : actionStatusById[action.id];
                                                const statusClass = status === 'running'
                                                    ? 'border-yellow-400/60'
                                                    : status === 'success'
                                                        ? 'border-green-400/60'
                                                        : status === 'error'
                                                            ? 'border-red-400/70'
                                                            : status === 'skipped'
                                                                ? 'border-gray-500/40'
                                                                : '';
                                                    const renderBlockMarker = (type: Action['type']) => {
                                                        const iconClass = "w-3 h-3";
                                                        if (type === 'if' || type === 'else') return <Split className={`${iconClass} text-blue-400`} />;
                                                        if (type === 'end') return <CornerRightDown className={`${iconClass} text-gray-500`} />;
                                                        if (type === 'while' || type === 'repeat') return <Repeat className={`${iconClass} text-amber-400`} />;
                                                        if (type === 'foreach') return <List className={`${iconClass} text-amber-300`} />;
                                                        if (type === 'on_error') return <AlertTriangle className={`${iconClass} text-red-400`} />;
                                                        if (type === 'set') return <Variable className={`${iconClass} text-green-400`} />;
                                                        if (type === 'stop') return <Square className={`${iconClass} text-red-400`} />;
                                                        if (type === 'click') return <MousePointer2 className={`${iconClass} text-blue-300`} />;
                                                        if (type === 'type') return <TypeIcon className={`${iconClass} text-green-300`} />;
                                                        if (type === 'hover') return <Target className={`${iconClass} text-purple-300`} />;
                                                        if (type === 'press') return <Keyboard className={`${iconClass} text-amber-300`} />;
                                                        if (type === 'wait') return <Clock className={`${iconClass} text-slate-300`} />;
                                                        if (type === 'scroll') return <ArrowDownUp className={`${iconClass} text-cyan-300`} />;
                                                        if (type === 'javascript') return <Code className={`${iconClass} text-yellow-300`} />;
                                                        if (type === 'csv') return <Table className={`${iconClass} text-emerald-300`} />;
                                                        if (type === 'merge') return <Layers className={`${iconClass} text-emerald-200`} />;
                                                        if (type === 'screenshot') return <Camera className={`${iconClass} text-emerald-300`} />;
                                                        if (type === 'start') return <PlayCircle className={`${iconClass} text-emerald-300`} />;
                                                        return <span className="text-[9px] text-white/20">|</span>;
                                                    };

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
                                                    className={`glass-card p-5 rounded-2xl space-y-4 group/item relative transition-[transform,box-shadow,opacity,filter,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform select-none touch-none ${statusClass} ${isDragging ? 'ring-2 ring-white/40 scale-[1.02] -translate-y-0.5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] opacity-85 z-20' : ''} ${dragOverIndex === idx && !isDragging ? 'ring-2 ring-blue-400/60 bg-blue-500/5' : ''} ${action.disabled ? 'opacity-40 grayscale' : ''}`}
                                                    style={{
                                                        transform: isDragging
                                                            ? `translateY(${(dragState?.currentY || 0) - (dragState?.pointerOffset || 0) - (dragState?.originTop || 0)}px)`
                                                            : translateY
                                                                ? `translateY(${translateY}px)`
                                                                : undefined,
                                                        marginLeft: depth ? depth * 12 : undefined
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[8px] font-bold text-white/20 font-mono tracking-tighter">{(idx + 1).toString().padStart(2, '0')}</div>
                                                            <div className="w-4 h-4 flex items-center justify-center">
                                                                {renderBlockMarker(action.type)}
                                                            </div>
                                                            <button
                                                                onClick={() => openActionPalette(action.id)}
                                                                className="action-type-select text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 focus:outline-none cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-blue-400/50"
                                                                aria-label={`Change action type: ${action.type}`}
                                                            >
                                                                {ACTION_CATALOG.find((item) => item.type === action.type)?.label || action.type}
                                                            </button>
                                                        </div>
                                                        <button
                                                            data-no-drag="true"
                                                            onClick={() => removeAction(action.id)}
                                                            className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100 focus:opacity-100 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                                                            aria-label="Delete action"
                                                            title="Delete action"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
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
                                                    {action.type === 'scroll' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Scroll Speed (ms)</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.key || ''}
                                                                    onChange={(v) => updateAction(action.id, { key: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder="500"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(action.type === 'type' || action.type === 'wait' || action.type === 'scroll' || action.type === 'javascript' || action.type === 'csv') && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">
                                                                {action.type === 'type'
                                                                    ? 'Content'
                                                                    : action.type === 'wait'
                                                                        ? 'Seconds'
                                                                        : action.type === 'scroll'
                                                                            ? 'Pixels'
                                                                            : action.type === 'csv'
                                                                                ? 'CSV Input'
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
                                                                ) : action.type === 'csv' ? (
                                                                    <CodeEditor
                                                                        value={action.value || ''}
                                                                        onChange={(v) => updateAction(action.id, { value: v })}
                                                                        language="plain"
                                                                        variables={currentTask.variables}
                                                                        className="min-h-[120px]"
                                                                        placeholder="name,age\nAda,31"
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
                                                            {action.type === 'type' && (
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Mode</label>
                                                                    <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                        <select
                                                                            value={action.typeMode || 'replace'}
                                                                            onChange={(e) =>
                                                                                updateAction(action.id, { typeMode: e.target.value as 'append' | 'replace' })
                                                                            }
                                                                            className="custom-select w-full bg-transparent border-none px-0 py-0 text-[11px] text-white"
                                                                        >
                                                                            {TYPE_MODE_OPTIONS.map((option) => (
                                                                                <option key={option.value} value={option.value}>
                                                                                    {option.label}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {action.type === 'screenshot' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Label (Optional)</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.value || ''}
                                                                    onChange={(v) => updateAction(action.id, { value: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder="checkout-step"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'press' && (() => {
                                                        const { modifiers, baseKey } = parsePressKey(action.key);
                                                        return (
                                                            <div className="space-y-2">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Key</label>
                                                                <div className="grid grid-cols-2 gap-1 text-[10px] text-white">
                                                                    {PRESS_MODIFIERS.map((modifier) => (
                                                                        <label key={modifier.value} className="inline-flex items-center space-x-1">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={modifiers.includes(modifier.value)}
                                                                                onChange={(e) => {
                                                                                    const nextModifiers = e.target.checked
                                                                                        ? [...modifiers, modifier.value]
                                                                                        : modifiers.filter((m) => m !== modifier.value);
                                                                                    updateAction(action.id, {
                                                                                        key: buildPressKey(nextModifiers, baseKey)
                                                                                    });
                                                                                }}
                                                                                className="h-3 w-3 rounded border border-white/30 bg-black/80"
                                                                            />
                                                                            <span className="uppercase text-[9px] text-white/70">{modifier.label}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <select
                                                                        value={baseKey}
                                                                        onChange={(e) => updateAction(action.id, { key: buildPressKey(modifiers, e.target.value) })}
                                                                        className="custom-select w-full bg-transparent border-none px-0 py-0 text-[11px] text-white"
                                                                    >
                                                                        <option value="">Select key</option>
                                                                        {PRESS_BASE_KEYS.map((keyOption) => (
                                                                            <option key={keyOption} value={keyOption}>
                                                                                {keyOption}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {action.type === 'if' && (() => {
                                                        const varKeys = Object.keys(currentTask.variables || {});
                                                        const normalizedVar = normalizeVarName(action.conditionVar || '');
                                                        const inferredType = normalizedVar && currentTask.variables?.[normalizedVar]?.type;
                                                        const varType = action.conditionVarType || inferredType || 'string';
                                                        const ops = conditionOps[varType as VarType] || conditionOps.string;
                                                        const opValue = action.conditionOp || ops[0].value;
                                                        return (
                                                            <div className="space-y-2">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Condition</label>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Variable</span>
                                                                        <input
                                                                            type="text"
                                                                            list={`if-var-${action.id}`}
                                                                            value={action.conditionVar || ''}
                                                                            onChange={(e) => updateAction(action.id, { conditionVar: e.target.value })}
                                                                            placeholder="variable name"
                                                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                                                                        />
                                                                        {varKeys.length > 0 && (
                                                                            <datalist id={`if-var-${action.id}`}>
                                                                                {varKeys.map((key) => (
                                                                                    <option key={key} value={key} />
                                                                                ))}
                                                                            </datalist>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Type</span>
                                                                        <select
                                                                            value={varType}
                                                                            onChange={(e) => {
                                                                                const nextType = e.target.value as VarType;
                                                                                const nextOps = conditionOps[nextType] || conditionOps.string;
                                                                                updateAction(action.id, {
                                                                                    conditionVarType: nextType,
                                                                                    conditionOp: nextOps[0].value,
                                                                                    conditionValue: nextType === 'boolean' ? '' : action.conditionValue || ''
                                                                                });
                                                                            }}
                                                                            className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[8px] font-bold uppercase text-white/60"
                                                                        >
                                                                            <option value="string">String</option>
                                                                            <option value="number">Number</option>
                                                                            <option value="boolean">Boolean</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Relation</span>
                                                                        <select
                                                                            value={opValue}
                                                                            onChange={(e) => updateAction(action.id, { conditionOp: e.target.value })}
                                                                            className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[8px] font-bold uppercase text-white/60"
                                                                        >
                                                                            {ops.map((opt) => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                {varType !== 'boolean' && (
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Value</span>
                                                                        <input
                                                                            type={varType === 'number' ? 'number' : 'text'}
                                                                            value={action.conditionValue || ''}
                                                                            onChange={(e) => updateAction(action.id, { conditionValue: e.target.value })}
                                                                            placeholder={varType === 'number' ? '0' : 'value'}
                                                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {action.type === 'while' && (() => {
                                                        const varKeys = Object.keys(currentTask.variables || {});
                                                        const normalizedVar = normalizeVarName(action.conditionVar || '');
                                                        const inferredType = normalizedVar && currentTask.variables?.[normalizedVar]?.type;
                                                        const varType = action.conditionVarType || inferredType || 'string';
                                                        const ops = conditionOps[varType as VarType] || conditionOps.string;
                                                        const opValue = action.conditionOp || ops[0].value;
                                                        return (
                                                            <div className="space-y-2">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Condition</label>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Variable</span>
                                                                        <input
                                                                            type="text"
                                                                            list={`while-var-${action.id}`}
                                                                            value={action.conditionVar || ''}
                                                                            onChange={(e) => updateAction(action.id, { conditionVar: e.target.value })}
                                                                            placeholder="variable name"
                                                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                                                                        />
                                                                        {varKeys.length > 0 && (
                                                                            <datalist id={`while-var-${action.id}`}>
                                                                                {varKeys.map((key) => (
                                                                                    <option key={key} value={key} />
                                                                                ))}
                                                                            </datalist>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Type</span>
                                                                        <select
                                                                            value={varType}
                                                                            onChange={(e) => {
                                                                                const nextType = e.target.value as VarType;
                                                                                const nextOps = conditionOps[nextType] || conditionOps.string;
                                                                                updateAction(action.id, {
                                                                                    conditionVarType: nextType,
                                                                                    conditionOp: nextOps[0].value,
                                                                                    conditionValue: nextType === 'boolean' ? '' : action.conditionValue || ''
                                                                                });
                                                                            }}
                                                                            className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[8px] font-bold uppercase text-white/60"
                                                                        >
                                                                            <option value="string">String</option>
                                                                            <option value="number">Number</option>
                                                                            <option value="boolean">Boolean</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Relation</span>
                                                                        <select
                                                                            value={opValue}
                                                                            onChange={(e) => updateAction(action.id, { conditionOp: e.target.value })}
                                                                            className="custom-select w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[8px] font-bold uppercase text-white/60"
                                                                        >
                                                                            {ops.map((opt) => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                {varType !== 'boolean' && (
                                                                    <div className="space-y-1">
                                                                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest pl-1">Value</span>
                                                                        <input
                                                                            type={varType === 'number' ? 'number' : 'text'}
                                                                            value={action.conditionValue || ''}
                                                                            onChange={(e) => updateAction(action.id, { conditionValue: e.target.value })}
                                                                            placeholder={varType === 'number' ? '0' : 'value'}
                                                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {action.type === 'repeat' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Times</label>
                                                            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                <RichInput
                                                                    value={action.value || ''}
                                                                    onChange={(v) => updateAction(action.id, { value: v })}
                                                                    variables={currentTask.variables}
                                                                    placeholder="3"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'foreach' && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Selector (Optional)</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.selector || ''}
                                                                        onChange={(v) => updateAction(action.id, { selector: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder=".list-item"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Variable (Array Name)</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.varName || ''}
                                                                        onChange={(v) => updateAction(action.id, { varName: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder="items"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'set' && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Variable Name</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.varName || ''}
                                                                        onChange={(v) => updateAction(action.id, { varName: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder="status"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Value</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.value || ''}
                                                                        onChange={(v) => updateAction(action.id, { value: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder="ready"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'merge' && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Sources</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.value || ''}
                                                                        onChange={(v) => updateAction(action.id, { value: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder="items, extraItems, {$block.output}"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Target Variable (Optional)</label>
                                                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[11px] focus-within:border-white/20 transition-all">
                                                                    <RichInput
                                                                        value={action.varName || ''}
                                                                        onChange={(v) => updateAction(action.id, { varName: v })}
                                                                        variables={currentTask.variables}
                                                                        placeholder="allItems"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {action.type === 'stop' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Outcome</label>
                                                            <select
                                                                value={action.value || 'success'}
                                                                onChange={(e) => updateAction(action.id, { value: e.target.value })}
                                                                className="custom-select w-full bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70 focus:outline-none"
                                                            >
                                                                <option value="success">Success</option>
                                                                <option value="error">Error</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {action.type === 'on_error' && (
                                                        <div className="text-[8px] text-gray-600 uppercase tracking-widest">
                                                            Runs if any action fails.
                                                        </div>
                                                    )}

                                                    {action.type === 'start' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-[7px] font-bold text-gray-600 uppercase tracking-widest pl-1">Task</label>
                                                            <select
                                                                value={action.value || ''}
                                                                onChange={(e) => updateAction(action.id, { value: e.target.value })}
                                                                className="custom-select w-full bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70 focus:outline-none"
                                                            >
                                                                <option value="" disabled>Select task</option>
                                                                {availableTasks.length === 0 && (
                                                                    <option value="" disabled>No other tasks</option>
                                                                )}
                                                                {availableTasks.map((task) => (
                                                                    <option key={task.id} value={task.id}>
                                                                        {task.name || task.id}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            });
                                        })()}
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
                                                onClick={() => openActionPalette()}
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
                                )}

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
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] text-gray-600 uppercase tracking-widest">Output format</span>
                                        <select
                                            value={currentTask.extractionFormat || 'json'}
                                            onChange={(e) => setCurrentTask({ ...currentTask, extractionFormat: e.target.value as 'json' | 'csv' })}
                                            className="custom-select bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[8px] font-bold uppercase text-white/60"
                                        >
                                            <option value="json">JSON</option>
                                            <option value="csv">CSV</option>
                                        </select>
                                    </div>
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

                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={currentTask.rotateUserAgents}
                                        onChange={(e) => setCurrentTask({ ...currentTask, rotateUserAgents: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Rotate UA</span>
                                </label>
                                <label
                                    className={`flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 transition-all ${rotateProxiesDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.05] cursor-pointer group'}`}
                                    title={rotateProxiesDisabled ? 'Configure proxies in Settings → Proxies to enable rotation.' : 'Rotate proxies per task.'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={currentTask.rotateProxies}
                                        onChange={(e) => setCurrentTask({ ...currentTask, rotateProxies: e.target.checked })}
                                        disabled={rotateProxiesDisabled}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className={`text-[10px] font-bold text-gray-500 uppercase tracking-widest ${rotateProxiesDisabled ? '' : 'group-hover:text-white'}`}>Rotate Proxies</span>
                                </label>
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={currentTask.rotateViewport}
                                        onChange={(e) => setCurrentTask({ ...currentTask, rotateViewport: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Rotate Viewport</span>
                                </label>
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={currentTask.includeShadowDom !== false}
                                        onChange={(e) => setCurrentTask({ ...currentTask, includeShadowDom: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Include Shadow DOM in HTML</span>
                                </label>
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={!!currentTask.disableRecording}
                                        onChange={(e) => setCurrentTask({ ...currentTask, disableRecording: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Disable automated recording</span>
                                </label>
                                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={!!currentTask.statelessExecution}
                                        onChange={(e) => setCurrentTask({ ...currentTask, statelessExecution: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Stateless execution (no shared cookies)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {editorView === 'json' && (
                        <JsonEditorPane
                            task={currentTask}
                            onChange={setCurrentTask}
                            onCopy={(text, id) => { void handleCopy(text, id); }}
                            copiedId={copied}
                        />
                    )}

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
                                                {new Date(version.timestamp).toLocaleString()} | {version.mode}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openVersionPreview(version.id)}
                                                disabled={versionPreviewLoading}
                                                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {versionPreviewLoading ? 'Loading...' : 'View'}
                                            </button>
                                            <button
                                                onClick={() => rollbackToVersion(version.id)}
                                                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                                            >
                                                Rollback
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div >
                <ActionPalette
                    open={actionPaletteOpen}
                    query={actionPaletteQuery}
                    onQueryChange={setActionPaletteQuery}
                    onClose={() => setActionPaletteOpen(false)}
                    onSelect={(type) => {
                        if (actionPaletteTargetId) {
                            if (type === 'if') {
                                updateAction(actionPaletteTargetId, {
                                    type,
                                    conditionVar: '',
                                    conditionVarType: 'string',
                                    conditionOp: 'equals',
                                    conditionValue: ''
                                });
                            } else if (type === 'while') {
                                updateAction(actionPaletteTargetId, {
                                    type,
                                    conditionVar: '',
                                    conditionVarType: 'string',
                                    conditionOp: 'equals',
                                    conditionValue: ''
                                });
                            } else {
                                updateAction(actionPaletteTargetId, { type });
                            }
                        } else {
                            addActionByType(type);
                        }
                        setActionPaletteOpen(false);
                    }}
                />

                <div className="p-8 border-t border-white/10 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onRun}
                            disabled={isExecuting && currentTask.mode !== 'headful'}
                            className="shine-effect flex-1 bg-white text-black py-4 rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isExecuting && currentTask.mode !== 'headful' ? (
                                <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : <Play className="w-3 h-3 fill-black" />}
                            <span>
                                {isExecuting && currentTask.mode === 'headful' ? 'Stop Headful' : isExecuting ? 'Running...' : 'Run Task'}
                            </span>
                        </button>
                        {isExecuting && (
                            <button
                                onClick={() => onStop?.()}
                                className="w-12 h-12 rounded-2xl border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                title="Stop task"
                            >
                                <Square className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside >
            <div
                className="w-2 cursor-col-resize bg-white/5 hover:bg-white/10 transition-colors"
                onPointerDown={(event) => {
                    event.preventDefault();
                    resizingRef.current = true;
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                }}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#020202] p-12 relative">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <ResultsPane
                    results={results}
                    pinnedResults={pinnedResults}
                    isExecuting={isExecuting}
                    isHeadful={currentTask.mode === 'headful'}
                    runId={runId}
                    onConfirm={onConfirm}
                    onNotify={onNotify}
                    onPin={onPinResults}
                    onUnpin={onUnpinResults}
                    fullWidth={currentTask.mode === 'headful'}
                />
                {versionPreview && (
                    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
                        <div className="glass-card w-full max-w-6xl rounded-[32px] border border-white/10 p-8 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em]">Task Snapshot</div>
                                    <div className="text-lg font-bold text-white">{versionPreview.snapshot.name}</div>
                                    <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                                        {new Date(versionPreview.timestamp).toLocaleString()} | {versionPreview.snapshot.mode}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setVersionPreview(null)}
                                        className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onRunSnapshot) onRunSnapshot(versionPreview.snapshot);
                                            setVersionPreview(null);
                                        }}
                                        className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-white text-black hover:bg-white/90 transition-all"
                                    >
                                        Run Version
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0">
                                <div className="space-y-2">
                                    <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Snapshot JSON</div>
                                    <CodeEditor
                                        readOnly
                                        value={JSON.stringify(versionPreview.snapshot, null, 2)}
                                        language="json"
                                        className="min-h-[320px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Output</div>
                                    <div className="glass-card rounded-2xl p-6 border border-white/10 text-[10px] text-gray-500">
                                        No output captured for this snapshot yet. Run this version to see results.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div >
    );
};

export default EditorScreen;
