const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock dependencies for settings.js
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
    console.log('--- Testing Proxy Route SSRF Protection (Refactored) ---');

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

    // Test POST /proxies with private IP
    console.log('Test 1: POST /proxies with localhost');
    const req1 = { body: { server: 'localhost:8080' } };
    await postProxies(req1, mockRes);
    assert.strictEqual(mockRes.statusCode, 400);
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');
    console.log('PASS');

    // Test POST /proxies/import with mixed IPs
    console.log('Test 2: POST /proxies/import with 127.0.0.1');
    const req2 = { body: { proxies: [{ server: 'google.com' }, { server: '127.0.0.1:1080' }] } };
    await postImport(req2, mockRes);
    assert.strictEqual(mockRes.statusCode, 400);
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');
    console.log('PASS');

    // Test PUT /proxies/:id with private IP
    console.log('Test 3: PUT /proxies/:id with 169.254.169.254');
    const req3 = { params: { id: 'p1' }, body: { server: '169.254.169.254' } };
    await putProxy(req3, mockRes);
    assert.strictEqual(mockRes.statusCode, 400);
    assert.strictEqual(mockRes.body.error, 'INVALID_URL');
    console.log('PASS');

    console.log('--- All Proxy Route SSRF tests passed! ---');
}

test().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
