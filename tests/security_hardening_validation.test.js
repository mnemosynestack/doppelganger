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

testInternalBypassHardening().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
