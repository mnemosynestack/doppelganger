const crypto = require('crypto');

const ROTATION_MODES = new Set(['round-robin', 'random']);

const normalizeServer = (raw) => {
    if (!raw) return '';
    let server = String(raw).trim();
    if (!server) return '';
    if (!server.includes('://')) {
        server = `http://${server}`;
    }
    return server;
};

const createProxyId = (seed) => {
    // SHA-256 is stronger than SHA-1 and avoids CodeQL warnings about weak cryptography.
    // The slice length remains 12 to keep IDs concise.
    const hash = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 12);
    return `proxy_${hash}`;
};

const normalizeProxy = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string') {
        let raw = entry.trim();
        if (!raw) return null;
        if (!raw.includes('://')) {
            raw = `http://${raw}`;
        }
        try {
            const parsed = new URL(raw);
            const server = `${parsed.protocol}//${parsed.host}`;
            const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
            const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
            return {
                id: createProxyId(`${server}|${username || ''}|${password || ''}`),
                server,
                username,
                password
            };
        } catch {
            return null;
        }
    }
    if (typeof entry === 'object') {
        const serverRaw = entry.server || entry.url || entry.proxy;
        const server = normalizeServer(serverRaw);
        if (!server) return null;
        const username = entry.username || entry.user;
        const password = entry.password || entry.pass;
        const id = entry.id || createProxyId(`${server}|${username || ''}|${password || ''}`);
        return {
            id,
            server,
            username,
            password,
            label: entry.label
        };
    }
    return null;
};

const normalizeRotationMode = (mode) => {
    if (ROTATION_MODES.has(mode)) return mode;
    return 'round-robin';
};

module.exports = {
    ROTATION_MODES,
    normalizeServer,
    createProxyId,
    normalizeProxy,
    normalizeRotationMode
};
