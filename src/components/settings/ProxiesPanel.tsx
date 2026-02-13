import { useRef, useState } from 'react';
import { ShieldCheck, Trash2, Star, StarOff, RefreshCw } from 'lucide-react';

interface ProxyEntry {
    id: string;
    server: string;
    username?: string;
    password?: string;
    label?: string;
}

interface ProxiesPanelProps {
    proxies: ProxyEntry[];
    defaultProxyId: string | null;
    includeDefaultInRotation: boolean;
    rotationMode: 'round-robin' | 'random';
    loading: boolean;
    onRefresh: () => void;
    onAdd: (entry: { server: string; username?: string; password?: string; label?: string }) => void;
    onImport: (entries: { server: string; username?: string; password?: string; label?: string }[]) => void;
    onUpdate: (id: string, entry: { server: string; username?: string; password?: string; label?: string }) => void;
    onDelete: (id: string) => void;
    onSetDefault: (id: string | null) => void;
    onToggleIncludeDefault: (enabled: boolean) => void;
    onRotationModeChange: (mode: 'round-robin' | 'random') => void;
}

const ProxiesPanel: React.FC<ProxiesPanelProps> = ({
    proxies,
    defaultProxyId,
    includeDefaultInRotation,
    rotationMode,
    loading,
    onRefresh,
    onAdd,
    onImport,
    onUpdate,
    onDelete,
    onSetDefault,
    onToggleIncludeDefault,
    onRotationModeChange
}) => {
    const [server, setServer] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [label, setLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editServer, setEditServer] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editLabel, setEditLabel] = useState('');
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const submit = () => {
        if (!server.trim()) return;
        onAdd({
            server: server.trim(),
            username: username.trim() || undefined,
            password: password.trim() || undefined,
            label: label.trim() || undefined
        });
        setServer('');
        setUsername('');
        setPassword('');
        setLabel('');
    };

    const startEdit = (proxy: ProxyEntry) => {
        setEditingId(proxy.id);
        setEditServer(proxy.server);
        setEditUsername(proxy.username || '');
        setEditPassword('');
        setEditLabel(proxy.label || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditServer('');
        setEditUsername('');
        setEditPassword('');
        setEditLabel('');
    };

    const saveEdit = () => {
        if (!editingId || !editServer.trim()) return;
        onUpdate(editingId, {
            server: editServer.trim(),
            username: editUsername.trim() || undefined,
            password: editPassword.trim() || undefined,
            label: editLabel.trim() || undefined
        });
        cancelEdit();
    };

    const parseProxyLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.includes('://')) {
            return { server: trimmed };
        }
        const parts = trimmed.split(':');
        if (parts.length < 2) return null;
        const host = parts[0]?.trim();
        const port = parts[1]?.trim();
        if (!host || !port) return null;
        const usernamePart = parts[2] ? parts[2].trim() : '';
        const passwordPart = parts.length > 3 ? parts.slice(3).join(':').trim() : '';
        return {
            server: `${host}:${port}`,
            username: usernamePart || undefined,
            password: passwordPart || undefined
        };
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        try {
            const contents = await Promise.all(files.map((file) => file.text()));
            const rawLines = contents
                .join('\n')
                .split(/\r?\n/)
                .flatMap((line) => line.split(/[,;]+/));
            const entries = rawLines.map(parseProxyLine).filter(Boolean) as {
                server: string;
                username?: string;
                password?: string;
                label?: string;
            }[];
            if (entries.length === 0) {
                setImportError('No valid proxies found in file.');
                return;
            }
            setImportError('');
            onImport(entries);
        } catch {
            setImportError('Failed to read file.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="glass-card p-8 rounded-[40px] space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Proxies</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Set defaults and rotate per task</p>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/5 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    placeholder="Proxy server (host:port or scheme://host:port)"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white"
                    aria-label="Proxy server address"
                />
                <input
                    type="text"
                    placeholder="Label (optional)"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white"
                    aria-label="Proxy label"
                />
                <input
                    type="text"
                    placeholder="Username (optional)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white"
                    aria-label="Proxy username"
                />
                <input
                    type="password"
                    placeholder="Password (optional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-[10px] text-white"
                    aria-label="Proxy password"
                />
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={submit}
                    className="px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest bg-white text-black hover:scale-105 transition-all"
                >
                    Add Proxy
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition-all"
                >
                    Import
                </button>
                <button
                    onClick={() => onSetDefault('host')}
                    className={`px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border border-white/10 transition-all ${defaultProxyId ? 'text-white hover:bg-white/5' : 'bg-white/10 text-white'}`}
                >
                    Use Host IP
                </button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleImport}
                className="hidden"
            />
            {importError && (
                <div className="text-[9px] text-red-400 uppercase tracking-widest">{importError}</div>
            )}
            <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Rotation mode</span>
                <select
                    value={rotationMode}
                    onChange={(e) => onRotationModeChange(e.target.value === 'random' ? 'random' : 'round-robin')}
                    className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white uppercase tracking-widest"
                    aria-label="Rotation mode"
                >
                    <option value="round-robin">Round robin</option>
                    <option value="random">Random</option>
                </select>
            </label>
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                <input
                    type="checkbox"
                    checked={includeDefaultInRotation}
                    onChange={(e) => onToggleIncludeDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-transparent"
                />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white">Include default IP in rotation pool</span>
            </label>

            <div className="space-y-3">
                {loading && (
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">Loading proxies...</div>
                )}
                {!loading && proxies.length === 0 && (
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">No proxies saved yet.</div>
                )}
                {!loading && proxies.map((proxy) => {
                    const isDefault = proxy.id === defaultProxyId;
                    const isEditing = proxy.id === editingId;
                    return (
                        <div key={proxy.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                            {isEditing ? (
                                <div className="w-full space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={editServer}
                                            onChange={(e) => setEditServer(e.target.value)}
                                            className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white"
                                            placeholder="Proxy server"
                                            aria-label="Proxy server"
                                        />
                                        <input
                                            type="text"
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white"
                                            placeholder="Label"
                                            aria-label="Label"
                                        />
                                        <input
                                            type="text"
                                            value={editUsername}
                                            onChange={(e) => setEditUsername(e.target.value)}
                                            className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white"
                                            placeholder="Username"
                                            aria-label="Username"
                                        />
                                        <input
                                            type="password"
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                            placeholder="Password (leave blank to keep)"
                                            className="bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-[10px] text-white"
                                            aria-label="Password"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={saveEdit}
                                            className="px-3 py-2 rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/5 transition-all"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="px-3 py-2 rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-white uppercase tracking-widest">
                                        {proxy.label || proxy.server}
                                    </div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest">
                                            {proxy.server}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onSetDefault(proxy.id)}
                                            className={`px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 ${isDefault ? 'bg-white text-black border-white' : 'border-white/10 text-white hover:bg-white/5'}`}
                                        >
                                            {isDefault ? <Star className="w-3 h-3" /> : <StarOff className="w-3 h-3" />}
                                            {isDefault ? 'Default' : 'Set Default'}
                                        </button>
                                        {proxy.id !== 'host' && (
                                            <>
                                                <button
                                                    onClick={() => startEdit(proxy)}
                                                    className="px-3 py-2 rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/5 transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => onDelete(proxy.id)}
                                                    className="px-3 py-2 rounded-xl border border-red-500/20 text-[9px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/10 transition-all inline-flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProxiesPanel;
