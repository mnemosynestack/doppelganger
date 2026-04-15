const assert = require('assert');
const { validateUrl } = require('../url-utils');

async function test() {
    console.log('--- Testing Proxy SSRF Validation ---');

    const testServers = [
        { server: 'localhost:8080', expected: 'blocked' },
        { server: '127.0.0.1:1080', expected: 'blocked' },
        { server: 'http://127.0.0.1', expected: 'blocked' },
        { server: '169.254.169.254', expected: 'blocked' },
        { server: 'http://[::1]', expected: 'blocked' },
        { server: 'google.com:80', expected: 'allowed' }
    ];

    let failures = 0;

    for (const item of testServers) {
        let urlToCheck = item.server;
        if (!urlToCheck.includes('://')) {
            urlToCheck = 'http://' + urlToCheck;
        }

        try {
            await validateUrl(urlToCheck);
            console.log(`ALLOWED: ${item.server}`);
            if (item.expected === 'blocked') {
                console.log(`  ❌ ERROR: Should have been blocked!`);
                failures++;
            }
        } catch (e) {
            console.log(`BLOCKED: ${item.server} - ${e.message}`);
            if (item.expected === 'allowed') {
                console.log(`  ❌ ERROR: Should have been allowed!`);
                failures++;
            }
        }
    }

    if (failures > 0) {
        process.exit(1);
    } else {
        console.log('\nAll tests passed!');
    }
}

test();
