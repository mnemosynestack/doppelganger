const express = require('express');
const crypto = require('crypto');
const { authRateLimiter, requireAuthForSettings, csrfProtection } = require('../middleware');
const { loadApiKey, saveApiKey } = require('../storage');
const { getUserAgentConfig, setUserAgentSelection } = require('../../../user-agent-settings');
const { listProxies, addProxy, addProxies, updateProxy, deleteProxy, deleteProxies, setDefaultProxy, setIncludeDefaultInRotation, setRotationMode } = require('../../../proxy-rotation');

const router = express.Router();

function createNewApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

// API Key
router.get('/api-key', authRateLimiter, requireAuthForSettings, async (req, res) => {
    try {
        const currentKey = await loadApiKey();
        res.json({ apiKey: currentKey || null });
    } catch (e) {
        console.error('[API_KEY] Load failed:', e);
        res.status(500).json({ error: 'API_KEY_LOAD_FAILED' });
    }
});

router.post('/api-key', requireAuthForSettings, (req, res) => {
    try {
        const bodyKey = req.body && typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '';
        const newKey = bodyKey || createNewApiKey();
        saveApiKey(newKey);
        res.json({ apiKey: newKey });
    } catch (e) {
        console.error('[API_KEY] Save failed:', e);
        res.status(500).json({ error: 'API_KEY_SAVE_FAILED', message: e.message });
    }
});

// User Agent
router.get('/user-agent', authRateLimiter, requireAuthForSettings, async (_req, res) => {
    try {
        res.json(await getUserAgentConfig());
    } catch (e) {
        console.error('[USER_AGENT] Load failed:', e);
        res.status(500).json({ error: 'USER_AGENT_LOAD_FAILED' });
    }
});

router.post('/user-agent', authRateLimiter, csrfProtection, requireAuthForSettings, async (req, res) => {
    if (typeof req.csrfToken === 'function') req.csrfToken();
    try {
        const selection = req.body && typeof req.body.selection === 'string' ? req.body.selection : null;
        await setUserAgentSelection(selection);
        res.json(await getUserAgentConfig());
    } catch (e) {
        console.error('[USER_AGENT] Save failed:', e);
        res.status(500).json({ error: 'USER_AGENT_SAVE_FAILED' });
    }
});

// Proxies
router.get('/proxies', requireAuthForSettings, (_req, res) => {
    try {
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Load failed:', e);
        res.status(500).json({ error: 'PROXY_LOAD_FAILED' });
    }
});

router.post('/proxies', requireAuthForSettings, (req, res) => {
    const { server, username, password, label, isRotatingPool, estimatedPoolSize } = req.body || {};
    if (!server || typeof server !== 'string') {
        return res.status(400).json({ error: 'MISSING_SERVER' });
    }
    try {
        const result = addProxy({ server, username, password, label, isRotatingPool, estimatedPoolSize });
        if (!result) return res.status(400).json({ error: 'INVALID_PROXY' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Add failed:', e);
        res.status(500).json({ error: 'PROXY_SAVE_FAILED' });
    }
});

router.post('/proxies/import', requireAuthForSettings, (req, res) => {
    const entries = req.body && Array.isArray(req.body.proxies) ? req.body.proxies : [];
    if (entries.length === 0) {
        return res.status(400).json({ error: 'MISSING_PROXIES' });
    }
    try {
        const result = addProxies(entries);
        if (!result) return res.status(400).json({ error: 'INVALID_PROXY' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Import failed:', e);
        res.status(500).json({ error: 'PROXY_IMPORT_FAILED' });
    }
});

router.put('/proxies/:id', requireAuthForSettings, (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id || id === 'host') return res.status(400).json({ error: 'INVALID_ID' });
    const { server, username, password, label, isRotatingPool, estimatedPoolSize } = req.body || {};
    if (!server || typeof server !== 'string') {
        return res.status(400).json({ error: 'MISSING_SERVER' });
    }
    try {
        const result = updateProxy(id, { server, username, password, label, isRotatingPool, estimatedPoolSize });
        if (!result) return res.status(404).json({ error: 'PROXY_NOT_FOUND' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Update failed:', e);
        res.status(500).json({ error: 'PROXY_UPDATE_FAILED' });
    }
});

router.delete('/proxies/:id', requireAuthForSettings, (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'MISSING_ID' });
    try {
        const result = deleteProxy(id);
        if (!result) return res.status(404).json({ error: 'PROXY_NOT_FOUND' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Delete failed:', e);
        res.status(500).json({ error: 'PROXY_DELETE_FAILED' });
    }
});

router.delete('/proxies', requireAuthForSettings, (req, res) => {
    const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
        return res.status(400).json({ error: 'MISSING_IDS' });
    }
    try {
        const result = deleteProxies(ids);
        if (!result) return res.status(400).json({ error: 'PROXIES_NOT_DELETED' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Bulk delete failed:', e);
        res.status(500).json({ error: 'PROXIES_BULK_DELETE_FAILED' });
    }
});

router.post('/proxies/default', requireAuthForSettings, (req, res) => {
    const id = req.body && req.body.id ? String(req.body.id) : '';
    try {
        const result = setDefaultProxy(id || null);
        if (!result) return res.status(404).json({ error: 'PROXY_NOT_FOUND' });
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Default failed:', e);
        res.status(500).json({ error: 'PROXY_DEFAULT_FAILED' });
    }
});

router.post('/proxies/rotation', requireAuthForSettings, (req, res) => {
    const body = req.body || {};
    const hasIncludeDefault = Object.prototype.hasOwnProperty.call(body, 'includeDefaultInRotation');
    const includeDefaultInRotation = !!body.includeDefaultInRotation;
    const rotationMode = typeof body.rotationMode === 'string' ? body.rotationMode : null;
    try {
        if (hasIncludeDefault) setIncludeDefaultInRotation(includeDefaultInRotation);
        if (rotationMode) setRotationMode(rotationMode);
        res.json(listProxies());
    } catch (e) {
        console.error('[PROXIES] Rotation toggle failed:', e);
        res.status(500).json({ error: 'PROXY_ROTATION_FAILED' });
    }
});

module.exports = router;
