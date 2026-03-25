const assert = require('assert');
const { requireApiKey } = require('../src/server/middleware');

async function testInternalBypassHardening() {
    console.log('--- Testing Internal Bypass Hardening ---');

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

    // Case 1: Spoofed X-Forwarded-For with TRUST_PROXY enabled
    // When TRUST_PROXY=1, req.ip might be 127.0.0.1, but req.socket.remoteAddress will be the actual proxy/attacker IP.
    console.log('Test 1: Spoofed loopback via headers (should be BLOCKED)');
    const req1 = {
        get: (header) => {
            if (header === 'x-internal-run') return '1';
            return null;
        },
        ip: '127.0.0.1', // Spoofed or set by trust proxy
        socket: {
            remoteAddress: '192.168.1.50' // Real external IP
        }
    };

    let nextCalled1 = false;
    await requireApiKey(req1, mockRes, () => { nextCalled1 = true; });

    assert.strictEqual(nextCalled1, false, 'Bypass should NOT work for non-local socket address');
    assert.strictEqual(mockRes.statusCode, 403, 'Should return 403 when API key is missing and not real loopback');
    console.log('PASS: Spoofing blocked');

    // Case 2: Genuine local connection
    console.log('Test 2: Genuine loopback connection (should be ALLOWED)');
    const req2 = {
        get: (header) => {
            if (header === 'x-internal-run') return '1';
            return null;
        },
        ip: '127.0.0.1',
        socket: {
            remoteAddress: '127.0.0.1'
        }
    };

    let nextCalled2 = false;
    await requireApiKey(req2, mockRes, () => { nextCalled2 = true; });

    assert.strictEqual(nextCalled2, true, 'Bypass SHOULD work for genuine local socket address');
    console.log('PASS: Genuine bypass allowed');

    // Case 3: Genuine IPv6 loopback connection
    console.log('Test 3: Genuine IPv6 loopback connection (should be ALLOWED)');
    const req3 = {
        get: (header) => {
            if (header === 'x-internal-run') return '1';
            return null;
        },
        ip: '::1',
        socket: {
            remoteAddress: '::1'
        }
    };

    let nextCalled3 = false;
    await requireApiKey(req3, mockRes, () => { nextCalled3 = true; });

    assert.strictEqual(nextCalled3, true, 'Bypass SHOULD work for genuine IPv6 local socket address');
    console.log('PASS: Genuine IPv6 bypass allowed');

    console.log('--- Internal Bypass Hardening Tests Passed ---');
}

async function testSessionConfig() {
    console.log('\n--- Testing Session Configuration (Functional) ---');
    const express = require('express');
    const session = require('express-session');
    const app = express();

    // Import current server settings to mock the environment
    const { SESSION_TTL_SECONDS } = require('../src/server/constants');
    const SESSION_COOKIE_SECURE = false;

    let capturedCookieOptions = null;
    app.use((req, res, next) => {
        const originalSession = session;
        const mockSession = (options) => {
            capturedCookieOptions = options.cookie;
            return originalSession(options);
        };
        // This is a bit hacky, but since we're in-process we can just check the code if needed
        // but let's try to actually find it in server.js via a safer way than regex if possible.
        next();
    });

    const fs = require('fs');
    const serverCode = fs.readFileSync('server.js', 'utf8');
    const httpOnlyMatch = serverCode.includes('httpOnly: true');
    assert.ok(httpOnlyMatch, 'Session cookie should have httpOnly: true in server.js');
    console.log('PASS: httpOnly: true found in session config');
}

async function testSecurityHeaders() {
    console.log('\n--- Testing Security Headers via Middleware ---');
    const fs = require('fs');
    const serverCode = fs.readFileSync('server.js', 'utf8');

    // Extract the middleware function body more robustly
    const startIdx = serverCode.indexOf("// Security Headers");
    const appUseIdx = serverCode.indexOf("app.use((req, res, next) => {", startIdx);
    const endIdx = serverCode.indexOf("next();", appUseIdx);
    const middlewareBody = serverCode.substring(appUseIdx + "app.use((req, res, next) => {".length, endIdx);

    const headers = {};
    const mockRes = {
        setHeader: (name, value) => {
            headers[name] = value;
        }
    };

    const SESSION_COOKIE_SECURE = true;
    const testMiddleware = new Function('req', 'res', 'next', 'SESSION_COOKIE_SECURE', middlewareBody + '\nnext();');

    testMiddleware({}, mockRes, () => {}, SESSION_COOKIE_SECURE);

    assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
    assert.strictEqual(headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.ok(headers['Content-Security-Policy'], 'CSP header missing');
    assert.ok(headers['Content-Security-Policy'].includes("default-src 'self'"), 'CSP missing default-src');
    assert.strictEqual(headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains; preload', 'HSTS header missing or incorrect');

    console.log('PASS: Security headers verified in middleware logic');
}

async function testWebhookFetchConfig() {
    console.log('\n--- Testing Webhook Fetch Configuration ---');
    const fs = require('fs');
    const serverCode = fs.readFileSync('server.js', 'utf8');
    assert.ok(serverCode.includes("redirect: 'error'"), "Webhook fetch should have redirect: 'error'");
    console.log("PASS: redirect: 'error' found in webhook fetch config");
}

async function runAllTests() {
    await testInternalBypassHardening();
    await testSessionConfig();
    await testSecurityHeaders();
    await testWebhookFetchConfig();
}

runAllTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
