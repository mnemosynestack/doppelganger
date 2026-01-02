import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { User, Task, ViewMode, Results, ConfirmRequest } from './types';
import Sidebar from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import EditorScreen from './components/EditorScreen';
import SettingsScreen from './components/SettingsScreen';
import LoadingScreen from './components/LoadingScreen';
import ExecutionsScreen from './components/ExecutionsScreen';
import ExecutionDetailScreen from './components/ExecutionDetailScreen';
import NotFoundScreen from './components/NotFoundScreen';
import CenterAlert from './components/app/CenterAlert';
import CenterConfirm from './components/app/CenterConfirm';
import EditorLoader from './components/app/EditorLoader';

export default function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<'checking' | 'login' | 'setup' | 'authenticated'>('checking');

    // Auth Screen State
    const [authError, setAuthError] = useState('');

    // Dashboard State
    const [tasks, setTasks] = useState<Task[]>([]);

    // Editor State
    const [currentTask, setCurrentTask] = useState<Task | null>(null);
    const [editorView, setEditorView] = useState<ViewMode>('visual');
    const [isExecuting, setIsExecuting] = useState(false);
    const [results, setResults] = useState<Results | null>(null);
    const [pinnedResultsByTask, setPinnedResultsByTask] = useState<Record<string, Results>>({});
    const [saveMsg, setSaveMsg] = useState('');

    const [centerAlert, setCenterAlert] = useState<{ message: string; tone?: 'success' | 'error' } | null>(null);
    const [centerConfirm, setCenterConfirm] = useState<ConfirmRequest | null>(null);
    const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
    const headfulViewerRef = useRef<Window | null>(null);
    const showAlert = (message: string, tone: 'success' | 'error' = 'success') => {
        setCenterAlert({ message, tone });
        if (tone === 'success') {
            setTimeout(() => {
                setCenterAlert((prev) => (prev && prev.message === message ? null : prev));
            }, 2000);
        }
    };
    const requestConfirm = (request: string | ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
            if (typeof request === 'string') {
                setCenterConfirm({ message: request });
            } else {
                setCenterConfirm(request);
            }
        });
    };
    const closeConfirm = (result: boolean) => {
        const resolver = confirmResolverRef.current;
        confirmResolverRef.current = null;
        setCenterConfirm(null);
        if (resolver) resolver(result);
    };
    const formatLabel = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;

    const openHeadfulViewer = () => {
        const { protocol, hostname } = window.location;
        const url = `${protocol}//${hostname}:54311/vnc.html?host=${hostname}&port=54311&path=websockify&autoconnect=true&reconnect=true&resize=scale`;
        try {
            if (!headfulViewerRef.current || headfulViewerRef.current.closed) {
                headfulViewerRef.current = window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                headfulViewerRef.current.focus();
            }
        } catch {}
    };

    const pinnedResultsKey = 'doppelganger.pinnedResults';
    const getTaskKey = (task?: Task | null) => task?.id ? String(task.id) : 'new';
    const currentTaskKey = getTaskKey(currentTask);
    const pinnedResults = currentTask ? pinnedResultsByTask[currentTaskKey] || null : null;

    const formatExecutionError = (rawMessage: string, mode?: string) => {
        const message = String(rawMessage || '').trim();
        if (!message) return 'Execution failed.';

        const lower = message.toLowerCase();
        if (mode === 'headful') {
            if (lower.includes('missing x server') || lower.includes('$display')) {
                return 'Headful browser could not start because no display server is available.';
            }
            if (lower.includes('failed to connect to the bus')) {
                return 'Headful browser could not start due to missing system services.';
            }
        }

        let cleaned = message;
        const flagsIndex = cleaned.indexOf('--disable-');
        if (flagsIndex > 0) {
            cleaned = cleaned.slice(0, flagsIndex).trim();
        }
        if (cleaned.length > 240) {
            cleaned = `${cleaned.slice(0, 240)}...`;
        }
        return cleaned || 'Execution failed.';
    };

    const isDisplayUnavailable = (message: string) => {
        const lower = String(message || '').toLowerCase();
        return lower.includes('missing x server')
            || lower.includes('$display')
            || lower.includes('platform failed to initialize')
            || lower.includes('no display server');
    };

    const makeDefaultTask = () => ({
        name: "Imported Task",
        url: "",
        mode: "scrape",
        wait: 3,
        selector: "",
        rotateUserAgents: false,
        humanTyping: false,
        stealth: {
            allowTypos: false,
            idleMovements: false,
            overscroll: false,
            deadClicks: false,
            fatigue: false,
            naturalTyping: false
        },
        actions: [],
        variables: {},
        includeShadowDom: true
    } as Task);


    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(pinnedResultsKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                    setPinnedResultsByTask(parsed);
                }
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(pinnedResultsKey, JSON.stringify(pinnedResultsByTask));
        } catch {
            // ignore
        }
    }, [pinnedResultsByTask]);

    useEffect(() => {
        if (!location.pathname.startsWith('/tasks') && editorView === 'history') {
            setEditorView('visual');
        }
    }, [location.pathname, editorView]);

    useEffect(() => {
        if (location.pathname === '/tasks/new' && !currentTask) {
            const newTask = buildNewTask();
            setCurrentTask(newTask);
            setResults(null);
        }
    }, [location.pathname, currentTask]);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.authenticated) {
                setUser(data.user);
                setAuthStatus('authenticated');
                loadTasks();
            } else {
                const sRes = await fetch('/api/auth/check-setup');
                const sData = await sRes.json();
                setAuthStatus(sData.setupRequired ? 'setup' : 'login');
            }
        } catch (e) {
            setAuthStatus('login');
        }
    };

    const handleAuthSubmit = async (email: string, pass: string, name?: string, passConfirm?: string) => {
        if (!email || !pass) return;
        if (authStatus === 'setup' && (!name || pass !== passConfirm)) {
            setAuthError(name ? "Passwords do not match" : "Name required");
            return;
        }

        const endpoint = authStatus === 'setup' ? '/api/auth/setup' : '/api/auth/login';
        const payload = authStatus === 'setup'
            ? { name, email, password: pass }
            : { email, password: pass };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setAuthError('');
                await checkAuth();
                navigate('/');
            } else {
                setAuthError(authStatus === 'setup' ? "Setup failed" : "Invalid credentials");
            }
        } catch (e) {
            setAuthError("Network error");
        }
    };

    const loadTasks = async () => {
        try {
            const res = await fetch('/api/tasks');
            const data = await res.json();
            const sorted = [...data].sort((a: Task, b: Task) => (b.last_opened || 0) - (a.last_opened || 0));
            setTasks(sorted);
            return sorted;
        } catch (e) {
            console.error("Failed to load tasks", e);
            return [];
        }
    };

    const logout = async () => {
        const confirmed = await requestConfirm('Are you sure you want to log out?');
        if (!confirmed) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        setAuthStatus('login');
        navigate('/');
        showAlert('Logged out.', 'success');
    };

    function buildNewTask(): Task {
        return {
            name: "Task " + Math.floor(Math.random() * 100),
            url: "",
            mode: "agent",
            wait: 3,
            selector: "",
            rotateUserAgents: false,
            humanTyping: false,
            stealth: {
                allowTypos: false,
                idleMovements: false,
                overscroll: false,
                deadClicks: false,
                fatigue: false,
                naturalTyping: false
            },
            actions: [],
            variables: {},
            extractionFormat: 'json',
            includeShadowDom: true
        };
    }

    const createNewTask = () => {
        const newTask = buildNewTask();
        setCurrentTask(newTask);
        setResults(null);
        navigate('/tasks/new');
    };

    const pinResults = (data: Results) => {
        if (!currentTask) return;
        setPinnedResultsByTask((prev) => ({ ...prev, [currentTaskKey]: data }));
    };

    const unpinResults = () => {
        if (!currentTask) return;
        setPinnedResultsByTask((prev) => {
            const next = { ...prev };
            delete next[currentTaskKey];
            return next;
        });
    };

    const touchTask = async (id: string) => {
        try {
            await fetch(`/api/tasks/${id}/touch`, { method: 'POST' });
            loadTasks();
        } catch (e) {
            console.error("Failed to touch task", e);
        }
    };

    const editTask = (task: Task) => {
        const migratedTask = { ...task };
        if (!migratedTask.variables || Array.isArray(migratedTask.variables)) migratedTask.variables = {};
        if (!migratedTask.stealth) {
            migratedTask.stealth = {
                allowTypos: false,
                idleMovements: false,
                overscroll: false,
                deadClicks: false,
                fatigue: false,
                naturalTyping: false
            };
        }
        if (!migratedTask.extractionFormat) migratedTask.extractionFormat = 'json';
        if (migratedTask.includeShadowDom === undefined) migratedTask.includeShadowDom = true;
        setCurrentTask(migratedTask);
        setResults(null);
        navigate(`/tasks/${task.id}`);
        if (task.id) touchTask(task.id);
    };

    const deleteTask = async (id: string) => {
        if (!await requestConfirm('Are you sure you want to delete this task?')) return;
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        loadTasks();
        if (location.pathname.includes(id)) {
            navigate('/dashboard');
        }
    };

    const saveTask = async () => {
        if (!currentTask) return;
        const taskToSave = { ...currentTask, last_opened: Date.now() };
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskToSave)
        });
        const saved = await res.json();
        setCurrentTask(saved);
        setSaveMsg("SAVED");
        setTimeout(() => setSaveMsg(''), 2000);
        loadTasks();
        if (location.pathname.includes('new')) {
            navigate(`/tasks/${saved.id}`, { replace: true });
        }
    };

    const stopHeadful = async () => {
        try {
            await fetch('/headful/stop', { method: 'POST' });
        } catch (e) {
            console.error('Failed to stop headful session', e);
        } finally {
            setIsExecuting(false);
        }
    };

    const runTaskWithSnapshot = async (taskOverride?: Task) => {
        const taskToRun = taskOverride || currentTask;
        if (!taskToRun || !taskToRun.url) return;

        if (isExecuting && taskToRun.mode === 'headful') {
            await stopHeadful();
            return;
        }

        if (taskToRun.mode === 'headful') {
            openHeadfulViewer();
        }

        setIsExecuting(true);
        setResults({
            url: taskToRun.url,
            logs: [],
            timestamp: 'Running...',
        });

        let payload: any = null;

        try {
            const cleanedVars: Record<string, any> = {};
            Object.entries(taskToRun.variables).forEach(([name, def]) => {
                cleanedVars[name] = def.value;
            });

            const resolveTemplate = (input: string) => {
                return input.replace(/\{\$(\w+)\}/g, (_match, name) => {
                    if (name === 'now') return new Date().toISOString();
                    const value = cleanedVars[name];
                    if (value === undefined || value === null || value === '') return '';
                    return String(value);
                });
            };

            const resolveMaybe = (value?: string) => {
                if (typeof value !== 'string') return value;
                return resolveTemplate(value);
            };

            const shouldResolve = taskToRun.mode !== 'agent';
            const resolvedTask = {
                ...taskToRun,
                url: shouldResolve ? resolveTemplate(taskToRun.url || '') : (taskToRun.url || ''),
                selector: shouldResolve ? resolveMaybe(taskToRun.selector) : taskToRun.selector,
                actions: shouldResolve
                    ? taskToRun.actions.map((action) => ({
                        ...action,
                        selector: resolveMaybe(action.selector),
                        value: resolveMaybe(action.value),
                        key: resolveMaybe(action.key)
                    }))
                    : taskToRun.actions
            };

            payload = {
                ...resolvedTask,
                taskVariables: cleanedVars,
                variables: cleanedVars,
                runSource: 'editor',
                taskId: taskToRun.id,
                taskName: taskToRun.name,
                taskSnapshot: taskToRun
            };

            const executeTask = async (mode: 'scrape' | 'agent' | 'headful') => {
                const res = await fetch(`/${mode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    let errorData: any = null;
                    try {
                        errorData = await res.json();
                    } catch {
                        errorData = null;
                    }
                    const error = new Error(errorData?.details || errorData?.error || "Request failed");
                    (error as any).code = errorData?.error;
                    throw error;
                }

                return res.json();
            };

            const data = await executeTask(taskToRun.mode);

            setResults({
                url: taskToRun.url,
                finalUrl: data.final_url,
                html: data.html,
                data: data.data ?? data.html ?? "No data captured.",
                screenshotUrl: data.screenshot_url,
                logs: data.logs || [],
                timestamp: new Date().toLocaleTimeString(),
            });
        } catch (e: any) {
            if (
                taskToRun?.mode === 'headful'
                && payload
                && (e?.code === 'HEADFUL_DISPLAY_UNAVAILABLE' || isDisplayUnavailable(e?.message || String(e)))
            ) {
                try {
                    const data = await (async () => {
                        const res = await fetch(`/scrape`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                            const errorData = await res.json();
                            throw new Error(errorData.details || errorData.error || "Request failed");
                        }
                        return res.json();
                    })();
                    data.logs = [`Headful display unavailable; ran headless instead.`, ...(data.logs || [])];
                    setResults({
                        url: taskToRun.url,
                        finalUrl: data.final_url,
                        html: data.html,
                        data: data.data ?? data.html ?? "No data captured.",
                        screenshotUrl: data.screenshot_url,
                        logs: data.logs || [],
                        timestamp: new Date().toLocaleTimeString(),
                    });
                    setIsExecuting(false);
                    return;
                } catch (fallbackError: any) {
                    const errorMessage = formatExecutionError(fallbackError?.message || String(fallbackError), taskToRun?.mode);
                    showAlert(`Execution crash: ${errorMessage}`, 'error');
                    setIsExecuting(false);
                    return;
                }
            }
            const errorMessage = formatExecutionError(e?.message || String(e), taskToRun?.mode);
            showAlert(`Execution crash: ${errorMessage}`, 'error');
            if (taskToRun?.mode === 'headful') {
                setIsExecuting(false);
            }
        } finally {
            if (taskToRun.mode !== 'headful') {
                setIsExecuting(false);
            }
        }
    };

    const runTask = async () => {
        await runTaskWithSnapshot();
    };

    const clearStorage = async (type: 'screenshots' | 'cookies') => {
        if (!await requestConfirm(`Delete all ${type}?`)) return;
        const endpoint = type === 'screenshots' ? '/api/clear-screenshots' : '/api/clear-cookies';
        await fetch(endpoint, { method: 'POST' });
        showAlert(`${formatLabel(type)} cleared.`, 'success');
    };

    const exportTasks = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            tasks
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `doppelganger-tasks-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showAlert('Tasks exported.', 'success');
    };

    const normalizeImportedTask = (raw: any, index: number): Task | null => {
        if (!raw || typeof raw !== 'object') return null;
        const base = makeDefaultTask();
        const merged: Task = { ...base, ...raw };
        if (!merged.name || typeof merged.name !== 'string') {
            merged.name = `Imported Task ${index + 1}`;
        }
        if (!merged.mode || !['scrape', 'agent', 'headful'].includes(merged.mode)) {
            merged.mode = 'scrape';
        }
        if (typeof merged.wait !== 'number') merged.wait = 3;
        if (!merged.stealth) merged.stealth = base.stealth;
        if (!merged.variables || Array.isArray(merged.variables)) merged.variables = {};
        if (!Array.isArray(merged.actions)) merged.actions = [];
        delete merged.versions;
        delete merged.last_opened;
        return merged;
    };

    const importTasks = async (file: File) => {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const list = Array.isArray(parsed) ? parsed : parsed?.tasks;
            if (!Array.isArray(list)) {
                showAlert('Invalid import file.', 'error');
                return;
            }
            const stamp = Date.now();
            const prepared = list
                .map((raw, index) => normalizeImportedTask(raw, index))
                .filter((task): task is Task => !!task)
                .map((task) => (task.id ? task : { ...task, id: `task_${stamp}` }));

            if (prepared.length === 0) {
                showAlert('No tasks to import.', 'error');
                return;
            }

            await Promise.all(prepared.map((task) => (
                fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                })
            )));
            await loadTasks();
            showAlert(`Imported ${prepared.length} task(s).`, 'success');
        } catch (e: any) {
            showAlert(`Import failed: ${e.message || 'Unknown error'}`, 'error');
        }
    };

    const getCurrentScreen = () => {
        if (location.pathname.startsWith('/tasks')) return 'editor';
        if (location.pathname === '/settings') return 'settings';
        if (location.pathname === '/executions') return 'executions';
        return 'dashboard';
    };

    let content: React.ReactNode;
    if (authStatus === 'login' || authStatus === 'setup') {
        content = <AuthScreen status={authStatus} onSubmit={handleAuthSubmit} error={authError} />;
    } else if (authStatus === 'checking') {
        content = <LoadingScreen title="Authenticating" subtitle="Verifying session state" />;
    } else {
        content = (
            <div className="h-full flex flex-row overflow-hidden bg-[#020202]">
                <Sidebar
                    onNavigate={(s) => {
                        if (s === 'dashboard') navigate('/dashboard');
                        else if (s === 'settings') {
                            navigate('/settings');
                        } else if (s === 'executions') {
                            navigate('/executions');
                        }
                    }}
                    onNewTask={createNewTask}
                    onLogout={logout}
                    currentScreen={getCurrentScreen()}
                />

                <Routes>
                    <Route path="/" element={<DashboardScreen tasks={tasks} onNewTask={createNewTask} onEditTask={editTask} onDeleteTask={deleteTask} onExportTasks={exportTasks} onImportTasks={importTasks} />} />
                    <Route path="/dashboard" element={<DashboardScreen tasks={tasks} onNewTask={createNewTask} onEditTask={editTask} onDeleteTask={deleteTask} onExportTasks={exportTasks} onImportTasks={importTasks} />} />
                    <Route path="/tasks/new" element={
                        currentTask ? (
                        <EditorScreen
                            currentTask={currentTask}
                            setCurrentTask={setCurrentTask}
                            tasks={tasks}
                            editorView={editorView}
                            setEditorView={setEditorView}
                            isExecuting={isExecuting}
                            onSave={saveTask}
                            onRun={runTask}
                            onRunSnapshot={runTaskWithSnapshot}
                            results={results}
                            pinnedResults={pinnedResults}
                            saveMsg={saveMsg}
                            onConfirm={requestConfirm}
                            onNotify={showAlert}
                            onPinResults={pinResults}
                            onUnpinResults={unpinResults}
                        />
                        ) : <LoadingScreen title="Initializing" subtitle="Preparing task workspace" />
                    } />
                    <Route path="/tasks/:id" element={<EditorLoader tasks={tasks} loadTasks={loadTasks} touchTask={touchTask} currentTask={currentTask} setCurrentTask={setCurrentTask} editorView={editorView} setEditorView={setEditorView} isExecuting={isExecuting} onSave={saveTask} onRun={runTask} onRunSnapshot={runTaskWithSnapshot} results={results} pinnedResults={pinnedResults} saveMsg={saveMsg} onConfirm={requestConfirm} onNotify={showAlert} onPinResults={pinResults} onUnpinResults={unpinResults} />} />
                    <Route path="/settings" element={
                        <SettingsScreen
                            onClearStorage={clearStorage}
                            onConfirm={requestConfirm}
                            onNotify={showAlert}
                        />
                    } />
                    <Route path="/executions" element={<ExecutionsScreen onConfirm={requestConfirm} onNotify={showAlert} />} />
                    <Route path="/executions/:id" element={<ExecutionDetailScreen onConfirm={requestConfirm} onNotify={showAlert} />} />
                    <Route path="*" element={<NotFoundScreen onBack={() => navigate('/dashboard')} />} />
                </Routes>
            </div>
        );
    }

    return (
        <div className="h-full">
            {centerAlert && (
                <CenterAlert
                    message={centerAlert.message}
                    tone={centerAlert.tone}
                    onClose={() => setCenterAlert(null)}
                />
            )}
            {centerConfirm && (
                <CenterConfirm
                    request={centerConfirm}
                    onResolve={closeConfirm}
                />
            )}
            {content}
        </div>
    );
}
