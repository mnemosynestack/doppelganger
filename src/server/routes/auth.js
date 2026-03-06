const express = require('express');
const bcrypt = require('bcryptjs');
const { loadUsers, saveUsers, saveSession } = require('../storage');
const { authRateLimiter } = require('../middleware');

const router = express.Router();

router.get('/check-setup', async (req, res) => {
    try {
        const users = await loadUsers();
        res.json({ setupRequired: users.length === 0 });
    } catch (e) {
        console.error('[AUTH] check-setup error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/setup', authRateLimiter, async (req, res) => {
    const users = await loadUsers();
    if (users.length > 0) return res.status(403).json({ error: 'ALREADY_SETUP' });
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name || !normalizedEmail || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), name, email: normalizedEmail, password: hashedPassword };
    await saveUsers([newUser]);

    try {
        // Fire and forget webhook ping for telemetry
        fetch('https://doppelganger-telemetry.vercel.app/collect-signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telemetry-secret': 'doppelganger-telemetry-v1'
            },
            body: JSON.stringify({
                name: newUser.name,
                email: newUser.email,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('[TELEMETRY] Failed to ping metrics', err.message));
    } catch (e) {
        // Ignore synchronous errors
    }
    req.session.regenerate(async (err) => {
        if (err) {
            console.error('[AUTH] Setup session regenerate failed:', err);
            return res.status(500).json({ error: 'SESSION_REGENERATE_FAILED' });
        }
        req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email };
        try {
            await saveSession(req);
            res.json({ success: true });
        } catch (saveErr) {
            console.error('[AUTH] Setup session save failed:', saveErr);
            return res.status(500).json({ error: 'SESSION_SAVE_FAILED' });
        }
    });
});

router.post('/login', authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const users = await loadUsers();
    const user = users.find(u => String(u.email || '').toLowerCase() === normalizedEmail);
    if (user && await bcrypt.compare(password, user.password)) {
        if (!user.telemetrySent) {
            try {
                // Fire and forget webhook ping for existing users
                fetch('https://doppelganger-telemetry.vercel.app/collect-signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-telemetry-secret': 'doppelganger-telemetry-v1'
                    },
                    body: JSON.stringify({
                        name: user.name,
                        email: user.email,
                        timestamp: new Date().toISOString()
                    })
                })
                    .then(async () => {
                        user.telemetrySent = true;
                        await saveUsers(users); // Update the local JSON database to mark as sent
                    })
                    .catch(err => console.error('[TELEMETRY] Failed to ping metrics', err.message));
            } catch (e) {
                // Ignore synchronous errors
            }
        }

        req.session.regenerate(async (err) => {
            if (err) {
                console.error('[AUTH] Login session regenerate failed:', err);
                return res.status(500).json({ error: 'SESSION_REGENERATE_FAILED' });
            }
            req.session.user = { id: user.id, name: user.name, email: user.email };
            try {
                await saveSession(req);
                res.json({ success: true });
            } catch (saveErr) {
                console.error('[AUTH] Login session save failed:', saveErr);
                return res.status(500).json({ error: 'SESSION_SAVE_FAILED' });
            }
        });
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
