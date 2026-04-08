const { executeAction } = require('../src/agent/action-handler');
const assert = require('assert');

async function runRepro() {
    console.log('--- Running SSRF Repro for http_request Action ---');

    // Force ALLOW_PRIVATE_NETWORKS to false for testing
    process.env.ALLOW_PRIVATE_NETWORKS = 'false';
    delete require.cache[require.resolve('../src/server/constants')];
    delete require.cache[require.resolve('../url-utils')];
    delete require.cache[require.resolve('../src/agent/action-handler')];

    const { executeAction } = require('../src/agent/action-handler');

    const originalFetch = global.fetch;
    let hitPrivate = false;

    global.fetch = async (url, options) => {
        const u = typeof url === 'string' ? url : url.href;
        console.log(`[MOCK FETCH] Request to: ${u}`);

        if (u.includes('redirect-to-private')) {
            return {
                ok: false,
                status: 302,
                headers: {
                    get: (name) => name.toLowerCase() === 'location' ? 'http://127.0.0.1/sensitive' : null
                },
                text: async () => 'Redirecting...'
            };
        }
        if (u.includes('127.0.0.1')) {
            hitPrivate = true;
            return {
                ok: true,
                status: 200,
                text: async () => 'Sensitive Data Exposed'
            };
        }
        return {
            ok: true,
            status: 200,
            text: async () => 'OK'
        };
    };

    const context = {
        logs: [],
        runtimeVars: {},
        resolveTemplate: (t) => t,
        baseUrl: 'http://127.0.0.1:11345',
        page: {
            url: () => 'http://safe.com'
        },
        options: {}
    };

    const act = {
        type: 'http_request',
        value: 'http://safe-domain.com/redirect-to-private',
        method: 'GET'
    };

    console.log('Executing http_request action...');
    try {
        await executeAction(act, context);
        if (hitPrivate) {
            console.error('FAILED: http_request action followed redirect to private IP!');
            process.exit(1);
        } else {
            console.log('PASS: Private IP was not hit (maybe fetch didn\'t follow redirect in this environment?)');
        }
    } catch (err) {
        if (err.message === 'Access to private network is restricted') {
            console.log('✓ SUCCESS: SSRF redirect blocked');
        } else {
            console.error('Unexpected error:', err);
            process.exit(1);
        }
    } finally {
        global.fetch = originalFetch;
    }
}

runRepro().catch(err => {
    console.error('Repro failed:', err);
    process.exit(1);
});
