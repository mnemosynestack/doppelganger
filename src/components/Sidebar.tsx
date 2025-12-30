import { Plus, Home, Settings as SettingsIcon, LogOut, List } from 'lucide-react';

interface SidebarProps {
    onNavigate: (screen: 'dashboard' | 'editor' | 'settings' | 'executions') => void;
    onNewTask: () => void;
    onLogout: () => void;
    currentScreen: 'dashboard' | 'editor' | 'settings' | 'executions';
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, onNewTask, onLogout, currentScreen }) => {
    return (
        <aside className="w-20 h-full border-r border-white/10 glass flex flex-col items-center py-8 shrink-0 z-50">
            <button onClick={() => onNavigate('dashboard')} className="mb-12 hover:opacity-80 transition-opacity">
                <img src="/icon.png" alt="Logo" className="w-8 h-8" onError={(e) => { e.currentTarget.src = '/icon.png' }} />
            </button>

            <div className="flex-1 flex flex-col gap-6">
                <button
                    onClick={onNewTask}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-white/5 hover:bg-white/10 transition-all"
                    title="New Task"
                >
                    <Plus className="w-6 h-6" />
                </button>

                <button
                    onClick={() => onNavigate('dashboard')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${currentScreen === 'dashboard' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                    title="Dashboard"
                >
                    <Home className="w-6 h-6" />
                </button>

                <button
                    onClick={() => onNavigate('settings')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${currentScreen === 'settings' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                    title="Settings"
                >
                    <SettingsIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={() => onNavigate('executions')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${currentScreen === 'executions' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
                    title="Executions"
                >
                    <List className="w-6 h-6" />
                </button>
            </div>

            <button
                onClick={onLogout}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all"
                title="Logout"
            >
                <LogOut className="w-6 h-6" />
            </button>
        </aside>
    );
};

export default Sidebar;
