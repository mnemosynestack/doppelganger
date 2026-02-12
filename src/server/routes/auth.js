const express = require('express');
const bcrypt = require('bcryptjs');
const { loadUsers, saveUsers, saveSession } = require('../storage');
const { authRateLimiter } = require('../middleware');

const router = express.Router();

router.get('/check-setup', (req, res) => {
    try {
        const users = loadUsers();
        res.json({ setupRequired: users.length === 0 });
    } catch (e) {
        console.error('[AUTH] check-setup error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/setup', authRateLimiter, async (req, res) => {
    const users = loadUsers();
    if (users.length > 0) return res.status(403).json({ error: 'ALREADY_SETUP' });
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name || !normalizedEmail || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), name, email: normalizedEmail, password: hashedPassword };
    saveUsers([newUser]);
    req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email };
    try {
        await saveSession(req);
    } catch (err) {
        console.error('[AUTH] Setup session save failed:', err);
        return res.status(500).json({ error: 'SESSION_SAVE_FAILED' });
    }
    res.json({ success: true });
});

router.post('/login', authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const users = loadUsers();
    const user = users.find(u => String(u.email || '').toLowerCase() === normalizedEmail);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user.id, name: user.name, email: user.email };
        try {
            await saveSession(req);
        } catch (err) {
            console.error('[AUTH] Login session save failed:', err);
            return res.status(500).json({ error: 'SESSION_SAVE_FAILED' });
        }
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'INVALID' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

router.get('/me', (req, res) => {
    res.json(req.session.user ? { authenticated: true, user: req.session.user } : { authenticated: false });
});

module.exports = router;
