import { useEffect, useState } from 'react';
import MaterialIcon from '../MaterialIcon';
import { Task } from '../../types';
import CodeEditor from '../CodeEditor';

interface JsonEditorPaneProps {
    task: Task;
    onChange: (task: Task) => void;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
}

const JsonEditorPane: React.FC<JsonEditorPaneProps> = ({ task, onChange, onCopy, copiedId }) => {
    const [draft, setDraft] = useState(() => JSON.stringify(task, null, 2));
    const [dirty, setDirty] = useState(false);

    const normalizeTask = (raw: any): Task => {
        const base = task;
        const merged: Task = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) } as Task;
        if (!merged.name || typeof merged.name !== 'string') merged.name = base.name || 'Task';
        if (!merged.mode || !['scrape', 'agent'].includes(merged.mode)) merged.mode = base.mode || 'agent';
        if (typeof merged.wait !== 'number') merged.wait = typeof base.wait === 'number' ? base.wait : 3;
        if (!merged.stealth) merged.stealth = base.stealth;
        if (!merged.variables || Array.isArray(merged.variables)) merged.variables = base.variables || {};
        if (!Array.isArray(merged.actions)) merged.actions = base.actions || [];
        if (!merged.extractionFormat) merged.extractionFormat = base.extractionFormat || 'json';
        if (merged.includeShadowDom === undefined) merged.includeShadowDom = base.includeShadowDom ?? true;
        if (base.id && merged.id !== base.id) merged.id = base.id;
        delete (merged as any).versions;
        delete (merged as any).last_opened;
        return merged;
    };

    useEffect(() => {
        if (dirty) return;
        setDraft(JSON.stringify(task, null, 2));
    }, [task, dirty]);

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Protocol JSON</span>
                <button
                    onClick={() => { onCopy(JSON.stringify(task, null, 2), 'json'); }}
                    className={`px-4 py-2 border text-[9px] font-bold rounded-xl uppercase transition-all flex items-center gap-2 ${copiedId === 'json' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                >
                    {copiedId === 'json' ? <MaterialIcon name="check" className="text-sm" /> : <MaterialIcon name="content_copy" className="text-sm" />}
                    {copiedId === 'json' ? 'Copied' : 'Copy'}
                </button>
            </div>
            <CodeEditor
                value={draft}
                onChange={(val) => {
                    setDraft(val);
                    try {
                        const parsed = JSON.parse(val);
                        const normalized = normalizeTask(parsed);
                        onChange(normalized);
                        setDirty(false);
                    } catch (err) {
                        setDirty(true);
                    }
                }}
                language="json"
                className="flex-1 min-h-0"
            />
        </div>
    );
};

export default JsonEditorPane;
