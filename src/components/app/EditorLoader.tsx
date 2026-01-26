import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Task } from '../../types';
import LoadingScreen from '../LoadingScreen';
import NotFoundScreen from '../NotFoundScreen';
import EditorScreen from '../EditorScreen';

interface EditorLoaderProps {
    tasks: Task[];
    loadTasks: () => Promise<Task[]>;
    touchTask: (id: string) => void;
    currentTask: Task | null;
    setCurrentTask: (task: Task) => void;
    editorView: any;
    setEditorView: any;
    isExecuting: boolean;
    onSave: () => void;
    onRun: () => void;
    onRunSnapshot?: (task: Task) => void;
    results: any;
    pinnedResults?: any;
    onPinResults?: any;
    onUnpinResults?: any;
    saveMsg: string;
    onConfirm: any;
    onNotify: any;
    runId?: string | null;
    onStop?: () => void;
    hasUnsavedChanges: boolean;
    onTaskLoaded?: (task: Task) => void;
}

const EditorLoader: React.FC<EditorLoaderProps> = ({
    tasks,
    loadTasks,
    touchTask,
    currentTask,
    setCurrentTask,
    hasUnsavedChanges,
    onTaskLoaded,
    ...props
}) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (currentTask?.id === id) return;

            setLoading(true);
            setNotFound(false);
            let targetTasks = tasks;
            if (tasks.length === 0) {
                targetTasks = await loadTasks();
            }

            const task = targetTasks.find((t: any) => String(t.id) === String(id));
            if (task) {
                const migrated = { ...task };
                if (!migrated.variables || Array.isArray(migrated.variables)) migrated.variables = {};
                if (!migrated.stealth) {
                    migrated.stealth = { allowTypos: false, idleMovements: false, overscroll: false, deadClicks: false, fatigue: false, naturalTyping: false };
                }
                if (Array.isArray(migrated.actions)) {
                    migrated.actions = migrated.actions.map((action, index) => {
                        if (action && action.id) return action;
                        return { ...action, id: `act_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}` };
                    });
                }
                if (migrated.includeShadowDom === undefined) migrated.includeShadowDom = true;
                setCurrentTask(migrated);
                onTaskLoaded?.(migrated);
                if (id) touchTask(id);
            } else {
                setNotFound(true);
            }
            setLoading(false);
        };
        init();
    }, [id, tasks]);

    if (notFound) {
        return (
            <NotFoundScreen
                title="Task Not Found"
                subtitle="This task does not exist or was deleted."
                onBack={() => navigate('/dashboard')}
            />
        );
    }

    if (loading || !currentTask || String(currentTask.id) !== String(id)) {
        return <LoadingScreen title="Loading Mission Data" subtitle="Syncing task payload" />;
    }

    return <EditorScreen currentTask={currentTask} setCurrentTask={setCurrentTask} tasks={tasks} hasUnsavedChanges={hasUnsavedChanges} {...props} />;
};

export default EditorLoader;
