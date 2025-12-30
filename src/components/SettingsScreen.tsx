import { useState, useEffect } from 'react';
import { Trash2, Database, Image as ImageIcon, Eye, EyeOff, Copy } from 'lucide-react';
import { ConfirmRequest } from '../types';

interface SettingsScreenProps {
    onClearStorage: (type: 'screenshots' | 'cookies') => void;
    onConfirm: (request: string | ConfirmRequest) => Promise<boolean>;
    onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({
    onClearStorage,
    onConfirm,
    onNotify
}) => {
    const [tab, setTab] = useState<'system' | 'data'>('system');
    const [screenshots, setScreenshots] = useState<{ name: string; url: string; size: number; modified: number }[]>([]);
    const [cookies, setCookies] = useState<{ name: string; value: string; domain?: string; path?: string; expires?: number }[]>([]);
    const [cookieOrigins, setCookieOrigins] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [expandedCookies, setExpandedCookies] = useState<Record<string, boolean>>({});
    const [decodedCookies, setDecodedCookies] = useState<Record<string, boolean>>({});
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const [apiKeySaving, setApiKeySaving] = useState(false);
    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    const loadData = async () => {
        setDataLoading(true);
        try {
            const [shotsRes, cookiesRes] = await Promise.all([
                fetch('/api/data/screenshots'),
                fetch('/api/data/cookies')
            ]);
            const shotsData = shotsRes.ok ? await shotsRes.json() : { screenshots: [] };
            const cookiesData = cookiesRes.ok ? await cookiesRes.json() : { cookies: [], origins: [] };
            setScreenshots(Array.isArray(shotsData.screenshots) ? shotsData.screenshots : []);
            setCookies(Array.isArray(cookiesData.cookies) ? cookiesData.cookies : []);
            setCookieOrigins(Array.isArray(cookiesData.origins) ? cookiesData.origins : []);
        } catch {
            setScreenshots([]);
            setCookies([]);
            setCookieOrigins([]);
        } finally {
            setDataLoading(false);
        }
    };

    const deleteScreenshot = async (name: string) => {
        const confirmed = await onConfirm(`Delete screenshot ${name}?`);
        if (!confirmed) return;
        const res = await fetch(`/api/data/screenshots/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (res.ok) {
            onNotify('Screenshot deleted.', 'success');
            loadData();
        } else {
            onNotify('Delete failed.', 'error');
        }
    };

    const deleteCookie = async (cookie: { name: string; domain?: string; path?: string }) => {
        const confirmed = await onConfirm(`Delete cookie ${cookie.name}?`);
        if (!confirmed) return;
        const res = await fetch('/api/data/cookies/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cookie.name, domain: cookie.domain, path: cookie.path })
        });
        if (res.ok) {
            onNotify('Cookie deleted.', 'success');
            loadData();
        } else {
            onNotify('Delete failed.', 'error');
        }
    };

    const cookieKey = (cookie: { name: string; domain?: string; path?: string; expires?: number }) => {
        return `${cookie.name}|${cookie.domain || ''}|${cookie.path || ''}|${cookie.expires || ''}`;
    };

    const isMostlyPrintable = (value: string) => {
        if (!value) return false;
        let printable = 0;
        for (let i = 0; i < value.length; i += 1) {
            const code = value.charCodeAt(i);
            if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
                printable += 1;
            }
        }
        return printable / value.length >= 0.85;
    };

    const decodeCookieValue = (value: string) => {
        if (!value) return null;
        if (/%[0-9A-Fa-f]{2}/.test(value)) {
            try {
                const decoded = decodeURIComponent(value);
                if (decoded !== value && isMostlyPrintable(decoded)) {
                    return { value: decoded, kind: 'URL' as const };
                }
            } catch {
                // Ignore invalid URI sequences
            }
        }
        if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length >= 12 && value.length % 4 === 0) {
            try {
                const decoded = atob(value);
                if (decoded && isMostlyPrintable(decoded)) {
                    return { value: decoded, kind: 'Base64' as const };
                }
            } catch {
                // Ignore invalid base64
            }
        }
        return null;
    };

    const toggleCookie = (cookie: { name: string; domain?: string; path?: string; expires?: number }) => {
        const key = cookieKey(cookie);
        setExpandedCookies((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleDecodedCookie = (cookie: { name: string; domain?: string; path?: string; expires?: number }) => {
        const key = cookieKey(cookie);
        setDecodedCookies((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const loadApiKey = async () => {
        setApiKeyLoading(true);
        try {
            const res = await fetch('/api/settings/api-key', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    onNotify('Session expired. Please log in again.', 'error');
                }
                setApiKey(null);
                return;
            }
            const data = await res.json();
            setApiKey(data.apiKey || null);
        } catch {
            setApiKey(null);
        } finally {
            setApiKeyLoading(false);
        }
    };

    const regenerateApiKey = async () => {
        setApiKeySaving(true);
        try {
            const res = await fetch('/api/settings/api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (!res.ok) {
                let detail = '';
                try {
                    const data = await res.json();
                    detail = data?.error || data?.message || '';
                } catch {
                    detail = '';
                }
                if (res.status === 401) {
                    onNotify('Session expired. Please log in again.', 'error');
                } else {
                    onNotify(`Failed to generate API key${detail ? `: ${detail}` : ''}.`, 'error');
                }
                return;
            }
            const data = await res.json();
            setApiKey(data.apiKey || null);
            onNotify('API key generated.', 'success');
        } catch {
            onNotify('Failed to generate API key.', 'error');
        } finally {
            setApiKeySaving(false);
        }
    };

    const copyApiKey = async () => {
        if (!apiKey) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(apiKey);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = apiKey;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (!ok) throw new Error('Copy failed');
            }
            onNotify('API key copied.', 'success');
        } catch {
            onNotify('Copy failed.', 'error');
        }
    };

    useEffect(() => {
        if (tab === 'data') loadData();
        if (tab === 'system') loadApiKey();
    }, [tab]);

    return (
        <main className="flex-1 p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-end justify-between mb-8">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-[0.4em]">System</p>
                        <h2 className="text-4xl font-bold tracking-tighter text-white">Settings</h2>
                    </div>
                    <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                        {(['system', 'data'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${tab === t ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {tab === 'system' && (
                    <>
                        <div className="glass-card p-8 rounded-[40px] space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400"><Database className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">API Key</h3>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Manage task API access</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3 font-mono text-[10px] text-blue-200/80 break-all min-h-[44px] flex items-center justify-between gap-3">
                                    <span className={apiKey && !apiKeyVisible ? 'text-[14px] leading-none' : undefined}>
                                        {apiKeyLoading
                                            ? 'Loading...'
                                            : (apiKey
                                                ? (apiKeyVisible ? apiKey : '••••••••••••••••••••••••••••••••••••••••')
                                                : 'No API key set')}
                                    </span>
                                    <button
                                        onClick={() => setApiKeyVisible((prev) => !prev)}
                                        disabled={!apiKey}
                                        className="p-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                                        title={apiKeyVisible ? 'Hide key' : 'Show key'}
                                        aria-label={apiKeyVisible ? 'Hide key' : 'Show key'}
                                    >
                                        {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={regenerateApiKey}
                                        disabled={apiKeySaving}
                                        className="flex-1 px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest bg-white text-black hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100"
                                    >
                                        {apiKey ? 'Rotate Key' : 'Generate Key'}
                                    </button>
                                    <button
                                        onClick={copyApiKey}
                                        disabled={!apiKey}
                                        className="flex-1 px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy Key
                                    </button>
                                </div>
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                                    Use this key in `key`, `x-api-key`, or `Authorization: Bearer` headers.
                                </p>
                            </div>
                        </div>
                        <div className="glass-card p-8 rounded-[40px] space-y-6">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400"><Trash2 className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Storage</h3>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Manage stored data</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => onClearStorage('screenshots')}
                                    className="flex-1 px-6 py-4 bg-red-500/5 border border-red-500/10 text-red-400 rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all"
                                >
                                    Clear Screenshots
                                </button>
                                <button
                                    onClick={() => onClearStorage('cookies')}
                                    className="flex-1 px-6 py-4 bg-yellow-500/5 border border-yellow-500/10 text-yellow-400 rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-yellow-500/10 transition-all"
                                >
                                    Reset Cookies
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {tab === 'data' && (
                    <>
                        <div className="glass-card p-8 rounded-[40px] space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400"><ImageIcon className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Screenshots</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Stored captures</p>
                                    </div>
                                </div>
                                <button
                                    onClick={loadData}
                                    className="px-4 py-2 border border-white/10 text-[9px] font-bold rounded-xl uppercase tracking-widest text-white hover:bg-white/5 transition-all"
                                >
                                    Refresh
                                </button>
                            </div>
                            {dataLoading && <div className="text-[9px] text-gray-500 uppercase tracking-widest">Loading data...</div>}
                            {!dataLoading && screenshots.length === 0 && (
                                <div className="text-[9px] text-gray-600 uppercase tracking-widest">No screenshots found.</div>
                            )}
                            <div className="space-y-3">
                                {screenshots.map((shot) => (
                                    <div key={shot.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                                        <div className="w-16 h-16 bg-black rounded-xl overflow-hidden shrink-0 border border-white/10">
                                            <img src={shot.url} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{shot.name}</div>
                                            <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                                                {new Date(shot.modified).toLocaleString()} | {(shot.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteScreenshot(shot.name)}
                                            className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-card p-8 rounded-[40px] space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400"><Database className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Cookies</h3>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Browser storage state</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onClearStorage('cookies')}
                                    className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-yellow-400 hover:bg-yellow-500/10 transition-all"
                                >
                                    Clear Cookies
                                </button>
                            </div>
                            {dataLoading && <div className="text-[9px] text-gray-500 uppercase tracking-widest">Loading data...</div>}
                            {!dataLoading && cookies.length === 0 && (
                                <div className="text-[9px] text-gray-600 uppercase tracking-widest">No cookies found.</div>
                            )}
                            <div className="space-y-3">
                                {cookies.map((cookie) => {
                                    const key = cookieKey(cookie);
                                    const isExpanded = !!expandedCookies[key];
                                    const value = cookie.value || '';
                                    const decodedCandidate = decodeCookieValue(value);
                                    const showDecoded = !!decodedCandidate && !!decodedCookies[key];
                                    const fullValue = showDecoded && decodedCandidate ? decodedCandidate.value : value;
                                    const displayValue = isExpanded || fullValue.length <= 120
                                        ? fullValue
                                        : `${fullValue.slice(0, 120)}...`;
                                    return (
                                        <div key={key} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{cookie.name}</div>
                                                    <div className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">
                                                        {(cookie.domain || 'local')} | {(cookie.path || '/')}
                                                        {cookie.expires ? ` | ${new Date(cookie.expires * 1000).toLocaleString()}` : ''}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {decodedCandidate && (
                                                        <button
                                                            onClick={() => toggleDecodedCookie(cookie)}
                                                            className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
                                                        >
                                                            {showDecoded ? 'Show Raw' : `Decode ${decodedCandidate.kind}`}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteCookie(cookie)}
                                                        className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => toggleCookie(cookie)}
                                                className="cursor-pointer rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono text-[10px] text-blue-200/80 whitespace-pre-wrap break-words"
                                                title="Click to expand/collapse"
                                            >
                                                {displayValue || '(empty)'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {!dataLoading && cookieOrigins.length > 0 && (
                                <div className="pt-2 text-[8px] text-gray-600 uppercase tracking-widest">
                                    Origins stored: {cookieOrigins.length}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default SettingsScreen;
