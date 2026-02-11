const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    normalizeServer,
    createProxyId,
    normalizeProxy,
    normalizeRotationMode
} = require('./proxy-utils');

const DATA_PROXY_FILE = path.join(__dirname, 'data', 'proxies.json');
const PROXY_FILES = [
    DATA_PROXY_FILE,
    path.join(__dirname, 'proxies.json')
];

let cached = {
    file: null,
    mtimeMs: 0,
    config: { proxies: [], defaultProxyId: null, includeDefaultInRotation: false, rotationMode: 'round-robin' }
};
let rotationIndex = 0;

const loadProxyFile = (filePath) => {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return { proxies: parsed, defaultProxyId: null, includeDefaultInRotation: false, rotationMode: 'round-robin' };
        }
        const proxies = Array.isArray(parsed.proxies) ? parsed.proxies : [];
        const defaultProxyId = parsed.defaultProxyId || null;
        const includeDefaultInRotation = !!parsed.includeDefaultInRotation;
        const rotationMode = normalizeRotationMode(parsed.rotationMode);
        return { proxies, defaultProxyId, includeDefaultInRotation, rotationMode };
    } catch {
        return { proxies: [], defaultProxyId: null, includeDefaultInRotation: false, rotationMode: 'round-robin' };
    }
};

const loadProxyConfig = () => {
    const filePath = PROXY_FILES.find((candidate) => {
        try {
            return fs.existsSync(candidate);
        } catch {
            return false;
        }
    });

    if (!filePath) {
        cached = { file: null, mtimeMs: 0, config: { proxies: [], defaultProxyId: null, includeDefaultInRotation: false, rotationMode: 'round-robin' } };
        return cached.config;
    }

    try {
        const stat = fs.statSync(filePath);
        const mtimeMs = stat.mtimeMs || 0;
        if (cached.file === filePath && cached.mtimeMs === mtimeMs) {
            return cached.config;
        }
        const rawConfig = loadProxyFile(filePath);
        const proxies = rawConfig.proxies.map(normalizeProxy).filter(Boolean);
        const defaultProxyId = rawConfig.defaultProxyId && proxies.some((proxy) => proxy.id === rawConfig.defaultProxyId)
            ? rawConfig.defaultProxyId
            : null;
        const config = {
            proxies,
            defaultProxyId,
            includeDefaultInRotation: !!rawConfig.includeDefaultInRotation,
            rotationMode: normalizeRotationMode(rawConfig.rotationMode)
        };
        cached = { file: filePath, mtimeMs, config };
        return config;
    } catch {
        cached = { file: filePath, mtimeMs: 0, config: { proxies: [], defaultProxyId: null, includeDefaultInRotation: false, rotationMode: 'round-robin' } };
        return cached.config;
    }
};

const saveProxyConfig = (config) => {
    const target = DATA_PROXY_FILE;
    const payload = {
        defaultProxyId: config.defaultProxyId || null,
        proxies: Array.isArray(config.proxies) ? config.proxies : [],
        includeDefaultInRotation: !!config.includeDefaultInRotation,
        rotationMode: normalizeRotationMode(config.rotationMode)
    };
    fs.writeFileSync(target, JSON.stringify(payload, null, 2));
    try {
        const stat = fs.statSync(target);
        cached = { file: target, mtimeMs: stat.mtimeMs || 0, config: payload };
    } catch {
        cached = { file: target, mtimeMs: 0, config: payload };
    }
    return payload;
};

const listProxies = () => {
    const config = loadProxyConfig();
    const hostEntry = {
        id: 'host',
        server: 'host_ip',
        label: 'Host IP (no proxy)'
    };
    return {
        proxies: [hostEntry, ...(config.proxies || [])],
        defaultProxyId: config.defaultProxyId || 'host',
        includeDefaultInRotation: !!config.includeDefaultInRotation,
        rotationMode: normalizeRotationMode(config.rotationMode)
    };
};

const addProxy = (entry) => {
    const normalized = normalizeProxy(entry);
    if (!normalized) return null;
    const config = loadProxyConfig();
    const proxies = [...config.proxies, { ...normalized, id: `proxy_${crypto.randomBytes(6).toString('hex')}` }];
    const next = { ...config, proxies };
    return saveProxyConfig(next);
};

const addProxies = (entries) => {
    if (!Array.isArray(entries)) return null;
    const normalizedEntries = entries.map(normalizeProxy).filter(Boolean);
    if (normalizedEntries.length === 0) return null;
    const config = loadProxyConfig();
    const existingByServer = new Map(
        config.proxies.map((proxy) => [String(proxy.server || '').toLowerCase(), proxy])
    );
    const seenServers = new Set();
    const updates = [];
    const additions = [];

    normalizedEntries.forEach((proxy) => {
        const serverKey = String(proxy.server || '').toLowerCase();
        if (!serverKey || seenServers.has(serverKey)) return;
        seenServers.add(serverKey);
        const existing = existingByServer.get(serverKey);
        if (existing) {
            updates.push({ ...existing, ...proxy, id: existing.id });
        } else {
            additions.push({ ...proxy, id: `proxy_${crypto.randomBytes(6).toString('hex')}` });
        }
    });

    const merged = config.proxies.map((proxy) => {
        const serverKey = String(proxy.server || '').toLowerCase();
        const replacement = updates.find((item) => String(item.server || '').toLowerCase() === serverKey);
        return replacement || proxy;
    });

    const proxies = [...merged, ...additions];
    const next = { ...config, proxies };
    return saveProxyConfig(next);
};

const updateProxy = (id, entry) => {
    if (!id) return null;
    const normalized = normalizeProxy(entry);
    if (!normalized) return null;
    const config = loadProxyConfig();
    const proxies = config.proxies.map((proxy) => {
        if (proxy.id !== id) return proxy;
        return { ...proxy, ...normalized, id };
    });
    if (!proxies.some((proxy) => proxy.id === id)) return null;
    return saveProxyConfig({ ...config, proxies });
};

const deleteProxy = (id) => {
    if (!id) return null;
    const config = loadProxyConfig();
    const proxies = config.proxies.filter((proxy) => proxy.id !== id);
    const defaultProxyId = config.defaultProxyId === id ? null : config.defaultProxyId;
    return saveProxyConfig({ ...config, proxies, defaultProxyId });
};

const setDefaultProxy = (id) => {
    const config = loadProxyConfig();
    if (!id) {
        return saveProxyConfig({ ...config, defaultProxyId: null });
    }
    if (!config.proxies.some((proxy) => proxy.id === id)) return null;
    return saveProxyConfig({ ...config, defaultProxyId: id });
};

const setIncludeDefaultInRotation = (enabled) => {
    const config = loadProxyConfig();
    return saveProxyConfig({ ...config, includeDefaultInRotation: !!enabled });
};

const setRotationMode = (mode) => {
    const config = loadProxyConfig();
    return saveProxyConfig({ ...config, rotationMode: normalizeRotationMode(mode) });
};

const getNextProxy = (proxies, mode) => {
    if (!proxies.length) return null;
    if (mode === 'random') {
        const index = Math.floor(Math.random() * proxies.length);
        return proxies[index];
    }
    const selected = proxies[rotationIndex % proxies.length];
    rotationIndex += 1;
    return selected;
};

const getProxySelection = (rotateProxies) => {
    const config = loadProxyConfig();
    const proxies = config.proxies || [];
    const hostEntry = { id: 'host', server: 'host_ip', label: 'Host IP (no proxy)' };
    const pool = [hostEntry, ...proxies];
    const defaultProxy = config.defaultProxyId
        ? proxies.find((proxy) => proxy.id === config.defaultProxyId) || null
        : null;
    const defaultIsHost = !config.defaultProxyId;
    const includeDefaultInRotation = !!config.includeDefaultInRotation;
    const rotationMode = normalizeRotationMode(config.rotationMode);

    if (rotateProxies) {
        let rotationPool = pool;
        if (!includeDefaultInRotation) {
            if (defaultIsHost) {
                rotationPool = pool.filter((proxy) => proxy.id !== 'host');
            } else {
                rotationPool = pool.filter((proxy) => proxy.id !== config.defaultProxyId);
            }
        }
        if (rotationPool.length > 0) {
            const picked = getNextProxy(rotationPool, rotationMode);
            return { proxy: picked && picked.id !== 'host' ? picked : null, mode: 'rotate' };
        }
        if (defaultProxy) return { proxy: defaultProxy, mode: 'default' };
        return { proxy: null, mode: 'host' };
    }

    if (defaultProxy) return { proxy: defaultProxy, mode: 'default' };
    return { proxy: null, mode: 'host' };
};

module.exports = {
    getProxySelection,
    listProxies,
    addProxy,
    addProxies,
    updateProxy,
    deleteProxy,
    setDefaultProxy,
    setIncludeDefaultInRotation,
    setRotationMode
};
