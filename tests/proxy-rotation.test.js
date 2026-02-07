const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getProxySelection } = require('../proxy-rotation.js');

const PROXY_FILE = path.join(__dirname, '../proxies.json');
const DATA_PROXY_FILE = path.join(__dirname, '../data/proxies.json');
const DATA_DIR = path.join(__dirname, '../data');

// Backup existing files
let backupProxyFile = null;
let backupDataProxyFile = null;

test.before(() => {
    try {
        if (fs.existsSync(PROXY_FILE)) {
            backupProxyFile = fs.readFileSync(PROXY_FILE, 'utf8');
            fs.unlinkSync(PROXY_FILE);
        }
        if (fs.existsSync(DATA_PROXY_FILE)) {
            backupDataProxyFile = fs.readFileSync(DATA_PROXY_FILE, 'utf8');
            fs.unlinkSync(DATA_PROXY_FILE);
        }
    } catch (e) {
        console.error('Error during backup:', e);
    }
});

test.after(() => {
    try {
        // Clean up current test files
        if (fs.existsSync(PROXY_FILE)) fs.unlinkSync(PROXY_FILE);
        if (fs.existsSync(DATA_PROXY_FILE)) fs.unlinkSync(DATA_PROXY_FILE);

        // Restore backups
        if (backupProxyFile) fs.writeFileSync(PROXY_FILE, backupProxyFile);
        if (backupDataProxyFile) {
            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(DATA_PROXY_FILE, backupDataProxyFile);
        }
    } catch (e) {
        console.error('Error during restore:', e);
    }
});

test.beforeEach(() => {
    try {
        if (fs.existsSync(PROXY_FILE)) fs.unlinkSync(PROXY_FILE);
        if (fs.existsSync(DATA_PROXY_FILE)) fs.unlinkSync(DATA_PROXY_FILE);
    } catch (e) {
        console.error('Error during cleanup:', e);
    }
});

let configWriteCounter = 0;
const writeConfig = (config) => {
    fs.writeFileSync(PROXY_FILE, JSON.stringify(config, null, 2));
    // Force update mtime to ensure cache invalidation in proxy-rotation.js
    // fs.statSync resolution might be low, so we manually increment the timestamp
    const stats = fs.statSync(PROXY_FILE);
    const newTime = new Date(stats.mtime.getTime() + (++configWriteCounter * 1000));
    fs.utimesSync(PROXY_FILE, newTime, newTime);
};

test('getProxySelection should return host mode when no proxies are configured', () => {
    writeConfig({ proxies: [] });
    const result = getProxySelection(true);
    assert.deepStrictEqual(result, { proxy: null, mode: 'host' });
});

test('getProxySelection should return rotate mode and a proxy when proxies exist and rotation is enabled', () => {
    const proxies = [
        { server: 'http://proxy1:8080' },
        { server: 'http://proxy2:8080' }
    ];
    writeConfig({ proxies, rotationMode: 'round-robin' });

    const result = getProxySelection(true);
    assert.strictEqual(result.mode, 'rotate');
    assert.ok(result.proxy);
    assert.ok(result.proxy.server.includes('proxy'));
});

test('getProxySelection should return host mode when proxies exist but rotation is disabled', () => {
    const proxies = [
        { server: 'http://proxy1:8080' }
    ];
    writeConfig({ proxies });

    const result = getProxySelection(false);
    assert.deepStrictEqual(result, { proxy: null, mode: 'host' });
});

test('getProxySelection should return default proxy if set and rotation is disabled', () => {
    const proxies = [
        { id: 'p1', server: 'http://proxy1:8080' },
        { id: 'p2', server: 'http://proxy2:8080' }
    ];
    writeConfig({ proxies, defaultProxyId: 'p1' });

    const result = getProxySelection(false);
    assert.strictEqual(result.mode, 'default');
    assert.strictEqual(result.proxy.id, 'p1');
});

test('getProxySelection should respect random rotation mode', () => {
     const proxies = [
        { id: 'p1', server: 'http://proxy1:8080' },
        { id: 'p2', server: 'http://proxy2:8080' },
        { id: 'p3', server: 'http://proxy3:8080' }
    ];
    writeConfig({ proxies, rotationMode: 'random' });

    const result = getProxySelection(true);
    assert.strictEqual(result.mode, 'rotate');
    assert.ok(['p1', 'p2', 'p3'].includes(result.proxy.id));
});

test('getProxySelection should exclude default proxy from rotation when configured', () => {
    const proxies = [
        { id: 'p1', server: 'http://proxy1:8080' },
        { id: 'p2', server: 'http://proxy2:8080' }
    ];

    // defaultProxyId='p1', includeDefaultInRotation=false (default)
    writeConfig({
        proxies,
        defaultProxyId: 'p1',
        includeDefaultInRotation: false,
        rotationMode: 'round-robin'
    });

    // Only p2 remains in rotation pool
    const result = getProxySelection(true);
    assert.strictEqual(result.mode, 'rotate');
    assert.strictEqual(result.proxy.id, 'p2');
});

test('getProxySelection should include default proxy in rotation when configured', () => {
    const proxies = [
        { id: 'p1', server: 'http://proxy1:8080' },
        { id: 'p2', server: 'http://proxy2:8080' }
    ];

    writeConfig({
        proxies,
        defaultProxyId: 'p1',
        includeDefaultInRotation: true,
        rotationMode: 'round-robin'
    });

    // Pool has p1 and p2.
    const result = getProxySelection(true);
    assert.strictEqual(result.mode, 'rotate');
    assert.ok(['p1', 'p2'].includes(result.proxy.id));
});
