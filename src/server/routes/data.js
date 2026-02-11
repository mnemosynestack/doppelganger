const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, dataRateLimiter } = require('../middleware');
const { getStorageStateFile } = require('../storage');

const router = express.Router();
// We need to resolve public/captures relative to where server.js runs usually, or use absolute path logic
// In constants we defined DIST_DIR, DATA_DIR. Captures are in public/captures relative to root probably.
// In server.js: const capturesDir = path.join(__dirname, 'public', 'captures');
// server.js was in root.
const CAPTURES_DIR = path.join(__dirname, '../../../public/captures');

router.get('/captures', requireAuth, dataRateLimiter, async (_req, res) => {
    try {
        await fs.promises.access(CAPTURES_DIR);
    } catch {
        return res.json({ captures: [] });
    }
    const runId = String(_req.query?.runId || '').trim();
    const entriesRaw = await fs.promises.readdir(CAPTURES_DIR);
    const entries = (await Promise.all(
        entriesRaw
            .filter(name => /\.(png|jpg|jpeg|webm)$/i.test(name))
            .filter((name) => !runId || name.includes(runId))
            .map(async (name) => {
                const fullPath = path.join(CAPTURES_DIR, name);
                try {
                    const stat = await fs.promises.stat(fullPath);
                    const lower = name.toLowerCase();
                    const type = lower.endsWith('.webm') ? 'recording' : 'screenshot';
                    return {
                        name,
                        url: `/captures/${name}`,
                        size: stat.size,
                        modified: stat.mtimeMs,
                        type
                    };
                } catch {
                    return null;
                }
            })
    ))
        .filter(Boolean)
        .sort((a, b) => b.modified - a.modified);
    res.json({ captures: entries });
});

router.get('/screenshots', requireAuth, dataRateLimiter, async (_req, res) => {
    try {
        await fs.promises.access(CAPTURES_DIR);
    } catch {
        return res.json({ screenshots: [] });
    }
    const entriesRaw = await fs.promises.readdir(CAPTURES_DIR);
    const entries = (await Promise.all(
        entriesRaw
            .filter(name => /\.(png|jpg|jpeg)$/i.test(name))
            .map(async (name) => {
                const fullPath = path.join(CAPTURES_DIR, name);
                try {
                    const stat = await fs.promises.stat(fullPath);
                    return {
                        name,
                        url: `/captures/${name}`,
                        size: stat.size,
                        modified: stat.mtimeMs
                    };
                } catch {
                    return null;
                }
            })
    ))
        .filter(Boolean)
        .sort((a, b) => b.modified - a.modified);
    res.json({ screenshots: entries });
});

router.delete('/captures/:name', requireAuth, (req, res) => {
    const name = req.params.name;
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ error: 'INVALID_NAME' });
    }
    const targetPath = path.join(CAPTURES_DIR, name);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }
    res.json({ success: true });
});

router.get('/cookies', requireAuth, (req, res) => {
    const storageStateFile = getStorageStateFile();
    if (!fs.existsSync(storageStateFile)) return res.json({ cookies: [], origins: [] });
    try {
        const data = JSON.parse(fs.readFileSync(storageStateFile, 'utf8'));
        res.json({
            cookies: Array.isArray(data.cookies) ? data.cookies : [],
            origins: Array.isArray(data.origins) ? data.origins : []
        });
    } catch (e) {
        res.json({ cookies: [], origins: [] });
    }
});

router.post('/cookies/delete', requireAuth, (req, res) => {
    const { name, domain, path: cookiePath } = req.body || {};
    if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
    const storageStateFile = getStorageStateFile();
    if (!fs.existsSync(storageStateFile)) return res.json({ success: true });
    try {
        const data = JSON.parse(fs.readFileSync(storageStateFile, 'utf8'));
        const cookies = Array.isArray(data.cookies) ? data.cookies : [];
        const filtered = cookies.filter((cookie) => {
            if (cookie.name !== name) return true;
            if (domain && cookie.domain !== domain) return true;
            if (cookiePath && cookie.path !== cookiePath) return true;
            return false;
        });
        data.cookies = filtered;
        fs.writeFileSync(storageStateFile, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'DELETE_FAILED' });
    }
});

// Also handle the clear screenshots/cookies which were separate POSTs in server.js
router.post('/clear-screenshots', requireAuth, async (req, res) => {
    try {
        const exists = await fs.promises.access(CAPTURES_DIR).then(() => true).catch(() => false);
        if (exists) {
            const entries = await fs.promises.readdir(CAPTURES_DIR);
            await Promise.all(entries.map(async (entry) => {
                const entryPath = path.join(CAPTURES_DIR, entry);
                try {
                    const stat = await fs.promises.stat(entryPath);
                    if (stat.isFile()) {
                        await fs.promises.unlink(entryPath);
                    }
                } catch (e) {
                    // Ignore individual file errors
                }
            }));
        }
    } catch (e) {
        // Ignore general errors
    }
    res.json({ success: true });
});

router.post('/clear-cookies', requireAuth, (req, res) => {
    const storageStateFile = getStorageStateFile();
    if (fs.existsSync(storageStateFile)) {
        fs.unlinkSync(storageStateFile);
    }
    res.json({ success: true });
});

module.exports = router;
