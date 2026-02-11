const express = require('express');
const { requireAuth, requireApiKey } = require('../middleware');
const { loadTasks, saveTasks } = require('../storage');
const { taskMutex } = require('../state');
const { appendTaskVersion, cloneTaskForVersion } = require('../utils');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    res.json(await loadTasks());
});

router.get('/list', requireApiKey, async (req, res) => {
    const tasks = await loadTasks();
    const summary = tasks.map((task) => ({
        id: task.id,
        name: task.name || task.id
    }));
    res.json({ tasks: summary });
});

router.post('/', requireAuth, async (req, res) => {
    await taskMutex.lock();
    try {
        const tasks = await loadTasks();
        const newTask = req.body;
        if (!newTask.id) newTask.id = 'task_' + Date.now();

        const index = tasks.findIndex(t => t.id === newTask.id);
        if (index > -1) {
            appendTaskVersion(tasks[index]);
            newTask.versions = tasks[index].versions || [];
            tasks[index] = newTask;
        } else {
            newTask.versions = [];
            tasks.push(newTask);
        }

        saveTasks(tasks);
        res.json(newTask);
    } finally {
        taskMutex.unlock();
    }
});

router.post('/:id/touch', requireAuth, async (req, res) => {
    await taskMutex.lock();
    try {
        const tasks = await loadTasks();
        const index = tasks.findIndex(t => t.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
        tasks[index].last_opened = Date.now();
        saveTasks(tasks);
        res.json(tasks[index]);
    } finally {
        taskMutex.unlock();
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    await taskMutex.lock();
    try {
        let tasks = await loadTasks();
        tasks = tasks.filter(t => t.id !== req.params.id);
        saveTasks(tasks);
        res.json({ success: true });
    } finally {
        taskMutex.unlock();
    }
});

router.get('/:id/versions', requireAuth, async (req, res) => {
    const tasks = await loadTasks();
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    const versions = (task.versions || []).map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        name: v.snapshot?.name || task.name,
        mode: v.snapshot?.mode || task.mode
    }));
    res.json({ versions });
});

router.get('/:id/versions/:versionId', requireAuth, async (req, res) => {
    const tasks = await loadTasks();
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    const versions = task.versions || [];
    const version = versions.find(v => v.id === req.params.versionId);
    if (!version || !version.snapshot) return res.status(404).json({ error: 'VERSION_NOT_FOUND' });
    res.json({ snapshot: version.snapshot, metadata: { id: version.id, timestamp: version.timestamp } });
});

router.post('/:id/versions/clear', requireAuth, async (req, res) => {
    await taskMutex.lock();
    try {
        const tasks = await loadTasks();
        const index = tasks.findIndex(t => t.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
        tasks[index].versions = [];
        saveTasks(tasks);
        res.json({ success: true });
    } finally {
        taskMutex.unlock();
    }
});

router.post('/:id/rollback', requireAuth, async (req, res) => {
    await taskMutex.lock();
    try {
        const { versionId } = req.body || {};
        if (!versionId) return res.status(400).json({ error: 'MISSING_VERSION_ID' });
        const tasks = await loadTasks();
        const index = tasks.findIndex(t => t.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
        const task = tasks[index];
        const versions = task.versions || [];
        const version = versions.find(v => v.id === versionId);
        if (!version || !version.snapshot) return res.status(404).json({ error: 'VERSION_NOT_FOUND' });

        appendTaskVersion(task);
        const restored = { ...cloneTaskForVersion(version.snapshot), id: task.id, versions: task.versions };
        restored.last_opened = Date.now();
        tasks[index] = restored;
        saveTasks(tasks);
        res.json(restored);
    } finally {
        taskMutex.unlock();
    }
});

module.exports = router;
