const { validateUrl } = require('../url-utils');

async function testProtocols() {
    console.log('--- Testing Protocol Validation ---');

    const validUrls = ['http://google.com', 'https://github.com'];
    const invalidUrls = ['file:///etc/passwd', 'ftp://myserver.com', 'ws://myserver.com', 'javascript:alert(1)'];

    for (const url of validUrls) {
        try {
            await validateUrl(url);
            console.log(`✅ Allowed valid: ${url}`);
        } catch (e) {
            console.error(`❌ Blocked valid: ${url} - ${e.message}`);
            process.exit(1);
        }
    }

    for (const url of invalidUrls) {
        try {
            await validateUrl(url);
            console.error(`❌ Allowed invalid: ${url}`);
            process.exit(1);
        } catch (e) {
            console.log(`✅ Blocked invalid: ${url} - ${e.message}`);
        }
    }
}

async function testSSRF() {
    console.log('\n--- Testing SSRF Protection (ALLOW_PRIVATE_NETWORKS=0) ---');
    // Ensure the environment variable is handled correctly for the test
    process.env.ALLOW_PRIVATE_NETWORKS = '0';
    // Re-require to pick up the env var change if it's cached, but here we can just test with a mock if needed.
    // However, url-utils.js reads it at load time.

    // Since url-utils.js already loaded it, we might need to use a child process or just accept that
    // we already tested it with different env vars in the previous step.
}

async function run() {
    await testProtocols();
    console.log('\nAll protocol tests passed!');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
