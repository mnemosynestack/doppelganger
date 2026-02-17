import { useState, useEffect, useCallback } from 'react';
import { ConfirmRequest } from '../types';
import ApiKeyPanel from './settings/ApiKeyPanel';
import StoragePanel from './settings/StoragePanel';
import CapturesPanel from './settings/CapturesPanel';
import CookiesPanel from './settings/CookiesPanel';
import SettingsHeader from './settings/SettingsHeader';
import LayoutPanel from './settings/LayoutPanel';
import ProxiesPanel from './settings/ProxiesPanel';
import UserAgentPanel from './settings/UserAgentPanel';
import VersionPanel from './settings/VersionPanel';
import { APP_VERSION } from '@/utils/appInfo';

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
    const [tab, setTab] = useState<'system' | 'data' | 'proxies'>('system');
    const [captures, setCaptures] = useState<{ name: string; url: string; size: number; modified: number; type: 'screenshot' | 'recording' }[]>([]);
    const [cookies, setCookies] = useState<{ name: string; value: string; domain?: string; path?: string; expires?: number }[]>([]);
    const [cookieOrigins, setCookieOrigins] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const [apiKeySaving, setApiKeySaving] = useState(false);
    const [layoutSplitPercent, setLayoutSplitPercent] = useState(30);
    const [proxies, setProxies] = useState<{ id: string; server: string; username?: string; password?: string; label?: string }[]>([]);
    const [defaultProxyId, setDefaultProxyId] = useState<string | null>(null);
    const [includeDefaultInRotation, setIncludeDefaultInRotation] = useState(false);
    const [rotationMode, setRotationMode] = useState<'round-robin' | 'random'>('round-robin');
    const [proxiesLoading, setProxiesLoading] = useState(false);
    const [userAgentSelection, setUserAgentSelection] = useState('system');
    const [userAgentOptions, setUserAgentOptions] = useState<string[]>([]);
    const [userAgentLoading, setUserAgentLoading] = useState(false);

    const layoutStorageKey = 'doppelganger.layout.leftWidthPct';

    useEffect(() => {
        try {
            const stored = localStorage.getItem(layoutStorageKey);
            if (stored) {
                const value = Math.min(75, Math.max(25, Math.round(parseFloat(stored) * 100)));
                if (!Number.isNaN(value)) setLayoutSplitPercent(value);
            }
        } catch {
            // ignore
        }
    }, []);

    const loadData = useCallback(async () => {
        setDataLoading(true);
        try {
            const [capturesRes, cookiesRes] = await Promise.all([
                fetch('/api/data/captures'),
                fetch('/api/data/cookies')
            ]);
            const capturesData = capturesRes.ok ? await capturesRes.json() : { captures: [] };
            const cookiesData = cookiesRes.ok ? await cookiesRes.json() : { cookies: [], origins: [] };
            setCaptures(Array.isArray(capturesData.captures) ? capturesData.captures : []);
            setCookies(Array.isArray(cookiesData.cookies) ? cookiesData.cookies : []);
            setCookieOrigins(Array.isArray(cookiesData.origins) ? cookiesData.origins : []);
        } catch {
            setCaptures([]);
            setCookies([]);
            setCookieOrigins([]);
        } finally {
            setDataLoading(false);
        }
    }, []);

    const deleteCapture = useCallback(async (name: string) => {
        const confirmed = await onConfirm(`Delete capture ${name}?`);
        if (!confirmed) return;
        const res = await fetch(`/api/data/captures/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (res.ok) {
            onNotify('Capture deleted.', 'success');
            loadData();
        } else {
            onNotify('Delete failed.', 'error');
        }
    }, [onConfirm, onNotify, loadData]);

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

    const loadProxies = async () => {
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    onNotify('Session expired. Please log in again.', 'error');
                }
                setProxies([]);
                setDefaultProxyId(null);
                setRotationMode('round-robin');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
        } catch {
            setProxies([]);
            setDefaultProxyId(null);
            setIncludeDefaultInRotation(false);
            setRotationMode('round-robin');
        } finally {
            setProxiesLoading(false);
        }
    };

    const addProxy = async (entry: { server: string; username?: string; password?: string; label?: string }) => {
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(entry)
            });
            if (!res.ok) {
                let detail = '';
                try {
                    const data = await res.json();
                    detail = data?.error || data?.message || '';
                } catch {
                    detail = '';
                }
                onNotify(`Failed to add proxy${detail ? `: ${detail}` : ''}.`, 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Proxy added.', 'success');
        } catch {
            onNotify('Failed to add proxy.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const loadUserAgent = async () => {
        setUserAgentLoading(true);
        try {
            const res = await fetch('/api/settings/user-agent', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    onNotify('Session expired. Please log in again.', 'error');
                }
                setUserAgentSelection('system');
                setUserAgentOptions([]);
                return;
            }
            const data = await res.json();
            setUserAgentSelection(data.selection === 'system' ? 'system' : String(data.selection || 'system'));
            setUserAgentOptions(Array.isArray(data.userAgents) ? data.userAgents : []);
        } catch {
            setUserAgentSelection('system');
            setUserAgentOptions([]);
        } finally {
            setUserAgentLoading(false);
        }
    };

    const saveUserAgent = async (selection: string) => {
        setUserAgentLoading(true);
        try {
            const res = await fetch('/api/settings/user-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ selection })
            });
            if (!res.ok) {
                onNotify('Failed to update user agent.', 'error');
                return;
            }
            const data = await res.json();
            setUserAgentSelection(data.selection === 'system' ? 'system' : String(data.selection || 'system'));
            setUserAgentOptions(Array.isArray(data.userAgents) ? data.userAgents : []);
            onNotify('User agent updated.', 'success');
        } catch {
            onNotify('Failed to update user agent.', 'error');
        } finally {
            setUserAgentLoading(false);
        }
    };

    const importProxies = async (entries: { server: string; username?: string; password?: string; label?: string }[]) => {
        if (!entries.length) {
            onNotify('No valid proxies found in file.', 'error');
            return;
        }
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ proxies: entries })
            });
            if (!res.ok) {
                let detail = '';
                try {
                    const data = await res.json();
                    detail = data?.error || data?.message || '';
                } catch {
                    detail = '';
                }
                onNotify(`Failed to import proxies${detail ? `: ${detail}` : ''}.`, 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Proxies imported.', 'success');
        } catch {
            onNotify('Failed to import proxies.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const updateProxy = async (id: string, entry: { server: string; username?: string; password?: string; label?: string }) => {
        setProxiesLoading(true);
        try {
            const res = await fetch(`/api/settings/proxies/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(entry)
            });
            if (!res.ok) {
                let detail = '';
                try {
                    const data = await res.json();
                    detail = data?.error || data?.message || '';
                } catch {
                    detail = '';
                }
                onNotify(`Failed to update proxy${detail ? `: ${detail}` : ''}.`, 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Proxy updated.', 'success');
        } catch {
            onNotify('Failed to update proxy.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const deleteProxy = async (id: string) => {
        if (id === 'host') return;
        const confirmed = await onConfirm('Delete this proxy?');
        if (!confirmed) return;
        setProxiesLoading(true);
        try {
            const res = await fetch(`/api/settings/proxies/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) {
                onNotify('Delete failed.', 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Proxy deleted.', 'success');
        } catch {
            onNotify('Delete failed.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const setDefaultProxy = async (id: string | null) => {
        const normalized = id === 'host' ? null : id;
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies/default', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: normalized })
            });
            if (!res.ok) {
                onNotify('Failed to set default.', 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Default proxy updated.', 'success');
        } catch {
            onNotify('Failed to set default.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const toggleIncludeDefaultInRotation = async (enabled: boolean) => {
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies/rotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ includeDefaultInRotation: enabled })
            });
            if (!res.ok) {
                onNotify('Failed to update rotation setting.', 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Rotation setting updated.', 'success');
        } catch {
            onNotify('Failed to update rotation setting.', 'error');
        } finally {
            setProxiesLoading(false);
        }
    };

    const updateRotationMode = async (mode: 'round-robin' | 'random') => {
        setProxiesLoading(true);
        try {
            const res = await fetch('/api/settings/proxies/rotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ rotationMode: mode })
            });
            if (!res.ok) {
                onNotify('Failed to update rotation mode.', 'error');
                return;
            }
            const data = await res.json();
            setProxies(Array.isArray(data.proxies) ? data.proxies : []);
            setDefaultProxyId(data.defaultProxyId || null);
            setIncludeDefaultInRotation(!!data.includeDefaultInRotation);
            setRotationMode(data.rotationMode === 'random' ? 'random' : 'round-robin');
            onNotify('Rotation mode updated.', 'success');
        } catch {
            onNotify('Failed to update rotation mode.', 'error');
        } finally {
            setProxiesLoading(false);
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
        if (tab === 'system') {
            loadApiKey();
            loadUserAgent();
        }
        if (tab === 'proxies') loadProxies();
    }, [tab, loadData]);

    useEffect(() => {
        try {
            localStorage.setItem(layoutStorageKey, String(layoutSplitPercent / 100));
        } catch {
            // ignore
        }
    }, [layoutSplitPercent]);

    return (
        <main className="flex-1 p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto space-y-8">
                <SettingsHeader tab={tab} onTabChange={setTab} />

                {tab === 'system' && (
                    <>
                        <ApiKeyPanel
                            apiKey={apiKey}
                            loading={apiKeyLoading}
                            saving={apiKeySaving}
                            onRegenerate={regenerateApiKey}
                            onCopy={copyApiKey}
                        />
                        <UserAgentPanel
                            selection={userAgentSelection}
                            options={userAgentOptions}
                            loading={userAgentLoading}
                            onChange={saveUserAgent}
                        />
                        <LayoutPanel
                            splitPercent={layoutSplitPercent}
                            onChange={setLayoutSplitPercent}
                            onReset={() => setLayoutSplitPercent(30)}
                        />
                        <VersionPanel version={APP_VERSION} />
                        <StoragePanel onClearStorage={onClearStorage} />
                    </>
                )}

                {tab === 'data' && (
                    <>
                        <CapturesPanel
                            captures={captures}
                            loading={dataLoading}
                            onRefresh={loadData}
                            onDelete={deleteCapture}
                        />

                        <CookiesPanel
                            cookies={cookies}
                            originsCount={cookieOrigins.length}
                            loading={dataLoading}
                            onClear={() => onClearStorage('cookies')}
                            onDelete={deleteCookie}
                        />
                    </>
                )}

                {tab === 'proxies' && (
                    <ProxiesPanel
                        proxies={proxies}
                        defaultProxyId={defaultProxyId}
                        includeDefaultInRotation={includeDefaultInRotation}
                        rotationMode={rotationMode}
                        loading={proxiesLoading}
                        onRefresh={loadProxies}
                        onAdd={addProxy}
                        onImport={importProxies}
                        onUpdate={updateProxy}
                        onDelete={deleteProxy}
                        onSetDefault={setDefaultProxy}
                        onToggleIncludeDefault={toggleIncludeDefaultInRotation}
                        onRotationModeChange={updateRotationMode}
                    />
                )}
            </div>
        </main>
    );
};

export default SettingsScreen;
