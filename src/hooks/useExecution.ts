import { useState, useRef } from 'react';
import { Task, Results } from '../types';
import { formatExecutionError, isDisplayUnavailable } from '../utils/executionUtils';
import { ensureActionIds } from '../utils/taskUtils';

export function useExecution(showAlert: (msg: string, tone?: 'success' | 'error') => void) {
    const [isExecuting, setIsExecuting] = useState(false);
    const [results, setResults] = useState<Results | null>(null);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const executeAbortRef = useRef<AbortController | null>(null);

    const stopHeadful = async () => {
        try {
            await fetch('/headful/stop', { method: 'POST' });
        } catch (e) {
            console.error('Failed to stop headful session', e);
        } finally {
            setIsExecuting(false);
        }
    };

    const stopTask = async (currentTask: Task | null) => {
        if (currentTask?.mode === 'headful') {
            await stopHeadful();
            return;
        }
        if (activeRunId) {
            try {
                await fetch('/api/executions/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ runId: activeRunId })
                });
            } catch (e) {
                console.error('Failed to request stop', e);
            }
        }
        if (executeAbortRef.current) {
            executeAbortRef.current.abort();
        }
        setIsExecuting(false);
    };

    const runTaskWithSnapshot = async (taskToRunRaw: Task | null, currentTask: Task | null, setCurrentTask: (t: Task) => void) => {
        if (!taskToRunRaw || !taskToRunRaw.url) return;
        const taskToRun = ensureActionIds(taskToRunRaw);
        if (currentTask && taskToRun !== currentTask) {
            setCurrentTask(taskToRun);
        }

        const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        setActiveRunId(runId);

        if (isExecuting && taskToRun.mode === 'headful') {
            await stopHeadful();
            return;
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
                return input.replace(/\\{\$(\w+)\\}/g, (_match, name) => {
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
                taskSnapshot: taskToRun,
                runId
            };

            const executeTask = async (mode: 'scrape' | 'agent' | 'headful') => {
                const controller = new AbortController();
                executeAbortRef.current = controller;
                const res = await fetch(`/${mode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
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
                downloads: data.downloads,
                logs: data.logs || [],
                timestamp: new Date().toLocaleTimeString(),
            });
        } catch (e: any) {
            if (e?.name === 'AbortError') {
                showAlert('Execution stopped.', 'success');
                setIsExecuting(false);
                return;
            }
            if (
                taskToRun?.mode === 'headful'
                && payload
                && (e?.code === 'HEADFUL_DISPLAY_UNAVAILABLE' || isDisplayUnavailable(e?.message || String(e)))
            ) {
                try {
                    const data = await (async () => {
                        const controller = new AbortController();
                        executeAbortRef.current = controller;
                        const res = await fetch(`/scrape`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal
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
                        downloads: data.downloads,
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
            executeAbortRef.current = null;
            if (taskToRun.mode !== 'headful') {
                setIsExecuting(false);
            }
        }
    };

    return {
        isExecuting,
        results,
        setResults,
        activeRunId,
        runTaskWithSnapshot,
        stopTask
    };
}
