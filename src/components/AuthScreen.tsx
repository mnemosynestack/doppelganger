import { useState } from 'react';

interface AuthScreenProps {
    status: 'login' | 'setup';
    onSubmit: (email: string, pass: string, name?: string, passConfirm?: string) => Promise<void>;
    error: string;
    busy?: boolean;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ status, onSubmit, error, busy = false }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [passConfirm, setPassConfirm] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(email, pass, name, passConfirm);
    };

    const buttonLabel = status === 'setup'
        ? (busy ? 'Creating account...' : 'Create Account')
        : (busy ? 'Authenticating...' : 'Authenticate');

    return (
        <div className="fixed inset-0 z-[100] bg-[#020202] flex items-center justify-center">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="w-[400px] glass-card p-10 rounded-[48px] space-y-8 relative">
                <div className="text-center space-y-2">
                    <img src="/logo.png" alt="Doppelganger" className="h-10 mx-auto object-contain" />
                    {status === 'setup' && (
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">
                            Initializing System
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-4">
                        {status === 'setup' && (
                            <div className="space-y-2">
                                <label htmlFor="auth-name" className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Name</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Full Name"
                                    className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
                                    autoComplete="name"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label htmlFor="auth-email" className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Email</label>
                            <input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="auth-pass" className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Password</label>
                            <input
                                id="auth-pass"
                                type="password"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
                                required
                                autoComplete={status === 'setup' ? "new-password" : "current-password"}
                            />
                        </div>
                        {status === 'setup' && (
                            <div className="space-y-2">
                                <label htmlFor="auth-pass-confirm" className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Confirm Password</label>
                                <input
                                    id="auth-pass-confirm"
                                    type="password"
                                    value={passConfirm}
                                    onChange={(e) => setPassConfirm(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-600"
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={busy}
                        aria-busy={busy}
                        className="shine-effect w-full bg-white text-black py-4 rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-default flex items-center justify-center gap-3"
                    >
                        {busy && (
                            <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        )}
                        <span>{buttonLabel}</span>
                    </button>

                    {error && (
                        <div role="alert" className="text-[9px] font-bold text-red-500 text-center uppercase tracking-widest">
                            {error}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default AuthScreen;
