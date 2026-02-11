const express = require('express');
const { requireAuth, requireApiKey } = require('../middleware');
const { loadExecutions, saveExecutions } = require('../storage');
const { executionStreams, stopRequests, sendExecutionUpdate } = require('../state');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
    const executions = loadExecutions();
    res.json({ executions });
});

router.get('/list', requireApiKey, (req, res) => {
    const executions = loadExecutions();
    res.json({ executions });
});

router.get('/stream', requireAuth, (req, res) => {
    const runId = String(req.query.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'MISSING_RUN_ID' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');

    let clients = executionStreams.get(runId);
    if (!clients) {
        clients = new Set();
        executionStreams.set(runId, clients);
    }
    clients.add(res);

    const keepAlive = setInterval(() => {
        try {
            res.write(':keep-alive\n\n');
        } catch {
            // ignore
        }
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        clients.delete(res);
        if (clients.size === 0) executionStreams.delete(runId);
    });
});

router.get('/:id', requireAuth, (req, res) => {
    const executions = loadExecutions();
    const exec = executions.find(e => e.id === req.params.id);
    if (!exec) return res.status(404).json({ error: 'EXECUTION_NOT_FOUND' });
    res.json({ execution: exec });
});

router.post('/clear', requireAuth, (req, res) => {
    saveExecutions([]);
    res.json({ success: true });
});

router.post('/stop', requireAuth, (req, res) => {
    const runId = String(req.body?.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'MISSING_RUN_ID' });
    stopRequests.add(runId);
    // Try to notify the stream as well
    try {
        sendExecutionUpdate(runId, { status: 'stop_requested' });
    } catch {
        // ignore
    }
    res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const executions = loadExecutions().filter(e => e.id !== id);
    saveExecutions(executions);
    res.json({ success: true });
});

module.exports = router;
