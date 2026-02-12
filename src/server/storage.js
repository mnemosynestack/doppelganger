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
async function loadTasks() {
    try {
        return JSON.parse(await fs.promises.readFile(TASKS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

async function saveTasks(tasks) {
    await fs.promises.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// Execution Storage
async function loadExecutions() {
    try {
        return JSON.parse(await fs.promises.readFile(EXECUTIONS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

async function saveExecutions(executions) {
    await fs.promises.writeFile(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
}

async function appendExecution(entry) {
    const executions = await loadExecutions();
    executions.unshift(entry);
    if (executions.length > MAX_EXECUTIONS) {
        executions.length = MAX_EXECUTIONS;
    }
    await saveExecutions(executions);
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
