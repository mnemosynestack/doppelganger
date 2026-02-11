console.error("DEBUG: SERVER STARTING");
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Constants
const {
    DEFAULT_PORT,
    DIST_DIR,
    DATA_DIR,
    SESSIONS_DIR,
    SESSION_SECRET_FILE,
    SESSION_TTL_SECONDS,
    NOVNC_PORT,
    WEBSOCKIFY_PATH
} = require('./src/server/constants');

// Context & Utils
const {
    taskMutex,
    executionStreams,
    stopRequests,
    sendExecutionUpdate
} = require('./src/server/state');
const {
    findAvailablePort,
    isIpAllowed,
    proxyWebsockify
} = require('./src/server/utils');

// Middleware
const {
    authRateLimiter,
    dataRateLimiter,
    csrfProtection,
    requireIpAllowlist,
    requireAuth
} = require('./src/server/middleware');

// Feature Modules (Legacy/Existing)
const { handleScrape } = require('./scrape');
const { handleAgent, setProgressReporter, setStopChecker } = require('./agent');
const { handleHeadful, stopHeadful } = require('./headful');

// Routes
const authRoutes = require('./src/server/routes/auth');
const settingsRoutes = require('./src/server/routes/settings');
const taskRoutes = require('./src/server/routes/tasks');
const executionRoutes = require('./src/server/routes/executions');
const dataRoutes = require('./src/server/routes/data');
const viewRoutes = require('./src/server/routes/views');

const app = express();
const port = Number(process.env.PORT) || DEFAULT_PORT;

// Session Secret Setup
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    try {
        if (fs.existsSync(SESSION_SECRET_FILE)) {
            SESSION_SECRET = fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
        } else {
            SESSION_SECRET = crypto.randomBytes(48).toString('hex');
            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(SESSION_SECRET_FILE, SESSION_SECRET);
        }
    } catch (e) {
        console.warn('Failed to load session secret from disk, falling back to process env only.');
    }
}
if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
}

// Ensure Directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Trust Proxy
const TRUST_PROXY = ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
if (TRUST_PROXY) {
    app.set('trust proxy', true);
}

// Session Cookie Secure
const SESSION_COOKIE_SECURE = ['1', 'true', 'yes'].includes(String(process.env.SESSION_COOKIE_SECURE || '').toLowerCase());
if (!SESSION_COOKIE_SECURE && process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] SESSION_COOKIE_SECURE is not enabled. Set SESSION_COOKIE_SECURE=1 when running behind HTTPS.');
}

// Wire up Agent Callbacks
setProgressReporter(sendExecutionUpdate);
setStopChecker((runId) => {
    if (!runId) return false;
    if (stopRequests.has(runId)) {
        stopRequests.delete(runId);
        return true;
    }
    return false;
});

// App Middleware
app.use(requireIpAllowlist);
app.use(express.json({ limit: '50mb' }));

app.use(session({
    store: new FileStore({
        path: SESSIONS_DIR,
        ttl: SESSION_TTL_SECONDS,
        retries: 0
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: SESSION_COOKIE_SECURE,
        sameSite: 'strict',
        maxAge: SESSION_TTL_SECONDS * 1000
    }
}));

app.use(csrfProtection);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/data', dataRoutes);

// View Routes & Static
app.use('/', viewRoutes);

// Execution Entry Points (Top-level routes kept for compatibility/simplicity)
const registerExecution = (req, res, baseMeta = {}) => {
    // This is a simplified version of the one in server.js, 
    // relying on the fact that handleScrape/Agent/Headful will handle the response.
    // However, the original registerExecution wrapped res.json to capture result
    // and appended to execution log on finish.
    // We need to restore that logic here or import it.
    // Since it was local to server.js, I should probably implement it here or imports.
    // It depends on `appendExecution`.

    // For now, I will re-implement it here using imports.
    const { appendExecution } = require('./src/server/storage');

    const start = Date.now();
    const requestId = 'exec_' + start + '_' + Math.floor(Math.random() * 1000);
    res.locals.executionId = requestId;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        res.locals.executionResult = body;
        return originalJson(body);
    };
    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const body = req.body || {};
        const entry = {
            id: requestId,
            timestamp: start,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
            source: body.runSource || req.query.runSource || baseMeta.source || 'unknown',
            mode: body.mode || baseMeta.mode || 'unknown',
            taskId: body.taskId || baseMeta.taskId || null,
            taskName: body.name || baseMeta.taskName || null,
            url: body.url || req.query.url || null,
            taskSnapshot: body.taskSnapshot || null,
            result: res.locals.executionResult || null
        };
        appendExecution(entry);
    });
};

const preprocessScrapeRequest = (req) => {
    const vars = req.body?.taskVariables || req.body?.variables || req.query?.taskVariables || req.query?.variables || {};
    let safeVars = vars;
    if (typeof vars === 'string') {
        try { safeVars = JSON.parse(vars); } catch { }
    } else if (typeof vars !== 'object') {
        safeVars = {};
    }

    const resolve = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/\{\$([\w.]+)\}/g, (_match, name) => {
            if (name === 'now') return new Date().toISOString();
            const value = safeVars[name];
            if (value === undefined || value === null) return '';
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
            }
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        });
    };

    if (req.body) {
        if (req.body.url) req.body.url = resolve(req.body.url);
        if (req.body.selector) req.body.selector = resolve(req.body.selector);
        if (req.body.extractionScript) req.body.extractionScript = resolve(req.body.extractionScript);
    }
    if (req.query) {
        if (req.query.url) req.query.url = resolve(req.query.url);
        if (req.query.selector) req.query.selector = resolve(req.query.selector);
        if (req.query.extractionScript) req.query.extractionScript = resolve(req.query.extractionScript);
    }
};

app.all('/scrape', requireAuth, dataRateLimiter, (req, res) => {
    registerExecution(req, res, { mode: 'scrape' });
    preprocessScrapeRequest(req);
    return handleScrape(req, res);
});
app.all('/scraper', requireAuth, dataRateLimiter, (req, res) => {
    registerExecution(req, res, { mode: 'scrape' });
    preprocessScrapeRequest(req);
    return handleScrape(req, res);
});
app.all('/agent', requireAuth, dataRateLimiter, (req, res) => {
    registerExecution(req, res, { mode: 'agent' });
    try {
        const runId = String((req.body && req.body.runId) || req.query.runId || '').trim();
        if (runId) {
            sendExecutionUpdate(runId, { status: 'started' });
        }
    } catch {
        // ignore
    }
    return handleAgent(req, res);
});
app.post('/headful', requireAuth, dataRateLimiter, (req, res) => {
    registerExecution(req, res, { mode: 'headful' });
    if (req.body && typeof req.body.url === 'string') {
        const vars = req.body.taskVariables || req.body.variables || {};
        req.body.url = req.body.url.replace(/\{\$(\w+)\}/g, (_match, name) => {
            const value = vars[name];
            if (value === undefined || value === null) return '';
            return String(value);
        });
    }
    return handleHeadful(req, res);
});
app.post('/headful/stop', requireAuth, stopHeadful);

// Ensure public/captures directory exists
const capturesDir = path.join(__dirname, 'public', 'captures');
if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir, { recursive: true });
}

// NoVNC Setup
const novncDirCandidates = [
    '/opt/novnc',
    '/usr/share/novnc'
];
const novncDir = novncDirCandidates.find((candidate) => {
    try {
        return fs.existsSync(candidate);
    } catch {
        return false;
    }
});
const novncEnabled = !!novncDir;
if (novncDir) {
    app.use('/novnc', express.static(novncDir));
}

// Static Files
app.use('/captures', express.static(capturesDir));
app.use('/screenshots', express.static(capturesDir));
app.use(express.static(DIST_DIR));

// Headful Status Endpoint
app.get('/api/headful/status', (req, res) => {
    const detectContainer = () => {
        try {
            if (fs.existsSync('/.dockerenv')) return true;
        } catch {
            // ignore
        }
        try {
            const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
            if (/docker|kubepods|containerd|podman/i.test(cgroup)) return true;
        } catch {
            // ignore
        }
        return false;
    };
    const useNovnc = detectContainer() && novncEnabled;
    res.json({ useNovnc });
});

// Start Server
findAvailablePort(port, 20)
    .then((availablePort) => {
        if (availablePort !== port) {
            console.log(`Port ${port} in use, switched to ${availablePort}.`);
        }
        const server = app.listen(availablePort, '0.0.0.0', () => {
            const address = server.address();
            const displayPort = typeof address === 'object' && address ? address.port : availablePort;
            console.log(`Server running at http://localhost:${displayPort}`);
        });
        server.on('upgrade', async (req, socket, head) => {
            if (!await isIpAllowed(req.socket?.remoteAddress)) {
                try {
                    socket.destroy();
                } catch {
                    // ignore
                }
                return;
            }
            const handled = proxyWebsockify(req, socket, head);
            if (!handled) {
                socket.destroy();
            }
        });
        server.on('error', (err) => {
            console.error('Server failed to start:', err.message || err);
            process.exit(1);
        });
    })
    .catch((err) => {
        console.error('Server failed to start:', err.message || err);
        process.exit(1);
    });
