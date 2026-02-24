import { useState } from 'react';
import MaterialIcon from '../MaterialIcon';
import CopyButton from '../CopyButton';

interface ApiKeyPanelProps {
    apiKey: string | null;
    loading: boolean;
    saving: boolean;
    onRegenerate: () => void;
    onCopy: () => void;
}

const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ apiKey, loading, saving, onRegenerate, onCopy }) => {
    const [visible, setVisible] = useState(false);

    return (
        <div className="glass-card p-8 rounded-[40px] space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400"><MaterialIcon name="database" className="text-xl" /></div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">API Key</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Manage task API access</p>
                </div>
            </div>
            <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3 font-mono text-[10px] text-blue-200/80 break-all min-h-[44px] flex items-center justify-between gap-3">
                    <span className={apiKey && !visible ? 'text-[14px] leading-none' : undefined}>
                        {loading
                            ? 'Loading...'
                            : (apiKey
                                ? (visible ? apiKey : '••••••••••••••••••••••••••••••••••••••••')
                                : 'No API key set')}
                    </span>
                    <button
                        onClick={() => setVisible((prev) => !prev)}
                        disabled={!apiKey}
                        className="p-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                        title={visible ? 'Hide key' : 'Show key'}
                        aria-label={visible ? 'Hide key' : 'Show key'}
                    >
                        {visible ? <MaterialIcon name="visibility_off" className="text-base" /> : <MaterialIcon name="visibility" className="text-base" />}
                    </button>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onRegenerate}
                        disabled={saving}
                        aria-busy={saving}
                        className="flex-1 px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest bg-white text-black hover:scale-105 transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                        {saving && (
                            <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        )}
                        {saving ? (apiKey ? 'Rotating...' : 'Generating...') : (apiKey ? 'Rotate Key' : 'Generate Key')}
                    </button>
                    <CopyButton
                        text={apiKey || ''}
                        label="Copy Key"
                        disabled={!apiKey}
                        onCopy={onCopy}
                        className="flex-1 px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                        iconClassName="text-base"
                    />
                </div>
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                    Use this key in `key`, `x-api-key`, or `Authorization: Bearer` headers.
                </p>
            </div>
        </div>
    );
};

export default ApiKeyPanel;
