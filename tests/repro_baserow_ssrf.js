const baserow = require('../src/server/outputProviders/baserow');
const assert = require('assert');

// Mock fetch to simulate a redirect to a private IP
const originalFetch = global.fetch;

async function runRepro() {
    console.log('--- Running SSRF Repro for Baserow Output Provider ---');

    global.fetch = async (url, options) => {
        const u = typeof url === 'string' ? url : url.href;
        console.log(`[MOCK FETCH] Request to: ${u}`);
        if (u.includes('redirect-to-private')) {
            return {
                ok: false,
                status: 302,
                headers: {
                    get: (name) => name.toLowerCase() === 'location' ? 'http://127.0.0.1/admin' : null
                },
                text: async () => 'Redirecting...'
            };
        }
        if (u.includes('127.0.0.1')) {
            console.log('[MOCK FETCH] Hit private IP!');
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, message: 'Sensitive Data Exposed' }),
                text: async () => 'Sensitive Data Exposed'
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => '{}'
        };
    };

    const credential = {
        config: {
            baseUrl: 'http://safe-domain.com/redirect-to-private',
            token: 'test-token'
        }
    };
    const output = { tableId: '123' };
    const data = { field: 'value' };

    console.log('Attempting push to Baserow...');
    try {
        await baserow.push(credential, output, data);
        assert.fail('Should have thrown an SSRF error');
    } catch (err) {
        assert.strictEqual(err.message, 'Access to private network is restricted');
        console.log('PASS: SSRF redirect blocked correctly');
    } finally {
        global.fetch = originalFetch;
    }
}

runRepro().catch(err => {
    console.error('Repro script failed:', err);
    process.exit(1);
});
