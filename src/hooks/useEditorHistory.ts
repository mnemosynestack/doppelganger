import { useEffect, useRef, useCallback } from 'react';
import { Task } from '../types';
import { serializeTaskSnapshot } from '../utils/taskUtils';

export const useEditorHistory = (
    currentTask: Task,
    setCurrentTask: (task: Task) => void,
    onSave: (task: Task, createVersion: boolean) => void
) => {
    const historyRef = useRef<Task[]>([]);
    const historyPointerRef = useRef<number>(-1);
    const isUndoRedoActionRef = useRef<boolean>(false);
    const lastSavedSnapshotRef = useRef<string>('');

    useEffect(() => {
        if (isUndoRedoActionRef.current) {
            isUndoRedoActionRef.current = false;
            return;
        }

        // ⚡ Bolt: Use optimized serializeTaskSnapshot to exclude large version history from undo/redo state.
        // This reduces serialization complexity from O(N * V) to O(N).
        const snapshot = serializeTaskSnapshot(currentTask);
        if (snapshot === lastSavedSnapshotRef.current) {
            return;
        }

        const timeout = setTimeout(() => {
            lastSavedSnapshotRef.current = snapshot;

            if (historyPointerRef.current < historyRef.current.length - 1) {
                historyRef.current = historyRef.current.slice(0, historyPointerRef.current + 1);
            }

            historyRef.current.push(JSON.parse(snapshot));
            historyPointerRef.current = historyRef.current.length - 1;

            if (historyRef.current.length > 50) {
                historyRef.current.shift();
                historyPointerRef.current -= 1;
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [currentTask]);

    const undo = useCallback(() => {
        if (historyPointerRef.current > 0) {
            historyPointerRef.current -= 1;
            const historyItem = historyRef.current[historyPointerRef.current];
            // ⚡ Bolt: Re-inject current versions into the restored task to prevent data loss.
            // Items are stored as objects in historyRef via JSON.parse(serializeTaskSnapshot(currentTask)).
            const restoredTask = { ...historyItem, versions: currentTask.versions, last_opened: Date.now() };
            isUndoRedoActionRef.current = true;
            lastSavedSnapshotRef.current = serializeTaskSnapshot(restoredTask);
            setCurrentTask(restoredTask);
            onSave(restoredTask, false);
        }
    }, [setCurrentTask, onSave, currentTask.versions]);

    const redo = useCallback(() => {
        if (historyPointerRef.current < historyRef.current.length - 1) {
            historyPointerRef.current += 1;
            const historyItem = historyRef.current[historyPointerRef.current];
            // ⚡ Bolt: Re-inject current versions into the restored task to prevent data loss.
            const restoredTask = { ...historyItem, versions: currentTask.versions, last_opened: Date.now() };
            isUndoRedoActionRef.current = true;
            lastSavedSnapshotRef.current = serializeTaskSnapshot(restoredTask);
            setCurrentTask(restoredTask);
            onSave(restoredTask, false);
        }
    }, [setCurrentTask, onSave, currentTask.versions]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl) {
                const tagName = activeEl.tagName.toLowerCase();
                const isEditable = activeEl.getAttribute('contenteditable') === 'true';
                if (tagName === 'input' || tagName === 'textarea' || isEditable) return;
            }
            const ctrl = e.metaKey || e.ctrlKey;
            if (ctrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            } else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return { undo, redo };
};
