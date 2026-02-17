const fs = require('fs');
const path = require('path');
const {
    USERS_FILE,
    TASKS_FILE,
    EXECUTIONS_FILE,
    API_KEY_FILE,
    ALLOWED_IPS_FILE,
    STORAGE_STATE_PATH,
    MAX_EXECUTIONS,
    ALLOWED_IPS_TTL_MS
} = require('./constants');
const { parseIpList, normalizeIp } = require('./utils');

// User Storage
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Task Storage
let tasksCache = null;
let tasksLoadPromise = null;

async function loadTasks() {
    // Return a shallow copy if cache exists to prevent mutation by callers
    if (tasksCache) return [...tasksCache];

    // Handle concurrent initial loads
    if (tasksLoadPromise) {
        const result = await tasksLoadPromise;
        return [...result];
    }

    tasksLoadPromise = (async () => {
        try {
            const data = await fs.promises.readFile(TASKS_FILE, 'utf8');
            tasksCache = JSON.parse(data);
        } catch (e) {
            tasksCache = [];
        }
        tasksLoadPromise = null;
        return tasksCache;
    })();

    const result = await tasksLoadPromise;
    return [...result];
}

async function saveTasks(tasks) {
    // Update cache immediately for read consistency
    tasksCache = tasks;
    await fs.promises.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// Execution Storage
let executionsCache = null;
let executionsLoadPromise = null;

async function loadExecutions() {
    // Return a shallow copy if cache exists to prevent mutation by callers
    if (executionsCache) return [...executionsCache];

    // Handle concurrent initial loads
    if (executionsLoadPromise) {
        const result = await executionsLoadPromise;
        return [...result];
    }

    executionsLoadPromise = (async () => {
        try {
            const data = await fs.promises.readFile(EXECUTIONS_FILE, 'utf8');
            executionsCache = JSON.parse(data);
        } catch (e) {
            executionsCache = [];
        }
        executionsLoadPromise = null;
        return executionsCache;
    })();

    const result = await executionsLoadPromise;
    return [...result];
}

async function saveExecutions(executions) {
    // Update cache immediately for read consistency
    executionsCache = executions;
    await fs.promises.writeFile(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
}

async function appendExecution(entry) {
    // Ensure cache is loaded, but ignore the return value since it's a copy
    if (!executionsCache) await loadExecutions();

    // Modify the cache directly to ensure atomic updates for concurrent appends
    // This prevents the race condition where multiple concurrent appends
    // would otherwise read the same state and overwrite each other.
    executionsCache.unshift(entry);
    if (executionsCache.length > MAX_EXECUTIONS) {
        executionsCache.length = MAX_EXECUTIONS;
    }
    await saveExecutions(executionsCache);
}

// API Key Storage
async function loadApiKey() {
    let apiKey = null;
    try {
        const raw = await fs.promises.readFile(API_KEY_FILE, 'utf8');
        const data = JSON.parse(raw);
        apiKey = data && data.apiKey ? data.apiKey : null;
    } catch (e) {
        apiKey = null;
    }

    if (!apiKey) {
        try {
            const usersRaw = await fs.promises.readFile(USERS_FILE, 'utf8');
            const users = JSON.parse(usersRaw);
            if (Array.isArray(users) && users.length > 0 && users[0].apiKey) {
                apiKey = users[0].apiKey;
                saveApiKey(apiKey);
            }
        } catch (e) {
            // ignore
        }
    }

    return apiKey;
}

function saveApiKey(apiKey) {
    fs.writeFileSync(API_KEY_FILE, JSON.stringify({ apiKey }, null, 2));
    if (fs.existsSync(USERS_FILE)) {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            if (Array.isArray(users) && users.length > 0) {
                users[0].apiKey = apiKey;
                fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            }
        } catch (e) {
            // ignore
        }
    }
}

// Session Helper
const saveSession = (req) => new Promise((resolve, reject) => {
    if (!req.session) {
        return resolve();
    }
    req.session.save((err) => err ? reject(err) : resolve());
});

// Allowed IPs Storage
let allowedIpsCache = { env: null, file: null, mtimeMs: 0, set: null, lastCheck: 0 };

const loadAllowedIps = async () => {
    const envRaw = String(process.env.ALLOWED_IPS || '').trim();
    const now = Date.now();

    if (allowedIpsCache.set && (now - allowedIpsCache.lastCheck < ALLOWED_IPS_TTL_MS)) {
        return allowedIpsCache.set;
    }

    let filePath = null;
    let fileMtime = 0;
    let fileEntries = [];

    try {
        const stat = await fs.promises.stat(ALLOWED_IPS_FILE);
        filePath = ALLOWED_IPS_FILE;
        fileMtime = stat.mtimeMs || 0;
    } catch {
        filePath = null;
    }

    if (
        allowedIpsCache.set &&
        allowedIpsCache.env === envRaw &&
        allowedIpsCache.file === filePath &&
        allowedIpsCache.mtimeMs === fileMtime
    ) {
        allowedIpsCache.lastCheck = now;
        return allowedIpsCache.set;
    }

    if (filePath) {
        try {
            const raw = await fs.promises.readFile(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            fileEntries = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed.allowedIps)
                    ? parsed.allowedIps
                    : [];
        } catch {
            fileEntries = [];
        }
    }

    const combined = [
        ...parseIpList(envRaw),
        ...parseIpList(fileEntries)
    ]
        .map(normalizeIp)
        .filter(Boolean);

    const set = new Set(combined);
    allowedIpsCache = { env: envRaw, file: filePath, mtimeMs: fileMtime, set, lastCheck: now };
    return set;
};

// Storage State
const getStorageStateFile = () => {
    try {
        if (fs.existsSync(STORAGE_STATE_PATH)) {
            const stat = fs.statSync(STORAGE_STATE_PATH);
            if (stat.isDirectory()) {
                return path.join(STORAGE_STATE_PATH, 'storage_state.json');
            }
        }
    } catch { }
    return STORAGE_STATE_PATH;
};

module.exports = {
    loadUsers,
    saveUsers,
    loadTasks,
    saveTasks,
    loadExecutions,
    saveExecutions,
    appendExecution,
    loadApiKey,
    saveApiKey,
    saveSession,
    loadAllowedIps,
    getStorageStateFile
};
