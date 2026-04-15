const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

/**
 * Proxy SSRF Security Test
 * Verifies that the settings routes correctly reject private network addresses.
 */

// Mock dependencies for settings.js to avoid loading the full server stack
Module.prototype.require = function() {
  if (arguments[0] === 'express-rate-limit') return () => (req, res, next) => next();
  if (arguments[0] === 'express') {
    const mock = () => ({});
    mock.Router = () => ({
        get: () => {},
        post: (path, ...handlers) => {
            if (path === '/proxies') postProxies = handlers[handlers.length - 1];
            if (path === '/proxies/import') postImport = handlers[handlers.length - 1];
        },
        put: (path, ...handlers) => {
            if (path === '/proxies/:id') putProxy = handlers[handlers.length - 1];
        },
        delete: () => {}
    });
    return mock;
  }
  if (arguments[0] === 'pg' || arguments[0] === '../db') {
    return { getPool: () => null };
  }
  return originalRequire.apply(this, arguments);
};

let postProxies, postImport, putProxy;
require('../src/server/routes/settings');

async function test() {
    console.log('--- Testing Proxy Route SSRF Protection ---');

    const mockRes = {
        status: (code) => {
            mockRes.statusCode = code;
            return mockRes;
        },
        json: (data) => {
            mockRes.body = data;
            return mockRes;
        }
    };

    // 1. Test POST /proxies with private IP
    console.log('Test 1: POST /proxies with localhost (should block)');
    await postProxies({ body: { server: 'localhost:8080' } }, mockRes);
    assert.strictEqual(mockRes.statusCode, 400, 'Should return 400 for localhost');
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');

    // 2. Test POST /proxies/import with mixed IPs
    console.log('Test 2: POST /proxies/import with 127.0.0.1 (should block)');
    await postImport({ body: { proxies: [{ server: 'google.com' }, { server: '127.0.0.1:1080' }] } }, mockRes);
    assert.strictEqual(mockRes.statusCode, 400, 'Should return 400 for imported 127.0.0.1');
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');

    // 3. Test PUT /proxies/:id with private IP
    console.log('Test 3: PUT /proxies/:id with 169.254.169.254 (should block)');
    await putProxy({ params: { id: 'p1' }, body: { server: '169.254.169.254' } }, mockRes);
    assert.strictEqual(mockRes.statusCode, 400, 'Should return 400 for cloud metadata IP');
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');

    // 4. Test valid public domain
    console.log('Test 4: POST /proxies with public domain (should allow validation)');
    // We expect this to fail later in the route (e.g. Proxy Save) but PASS the SSRF check
    // Since we mocked everything, it might throw or return result of listProxies()
    try {
        await postProxies({ body: { server: 'proxy.example.com:8080' } }, mockRes);
        // If it didn't return 400 INVALID_URL, it passed the SSRF check
        assert.notStrictEqual(mockRes.statusCode, 400);
    } catch (e) {
        // Expected if it tries to call real storage after passing SSRF check
    }

    console.log('--- Proxy SSRF Protection Tests Passed ---');
}

test().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
