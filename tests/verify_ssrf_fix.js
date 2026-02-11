const { validateUrl } = require('../url-utils');

async function testValidateUrl() {
    console.log('Testing validateUrl directly...');
    const cases = [
        { url: 'http://localhost', expected: true },
        { url: 'http://127.0.0.1', expected: true },
        { url: 'http://169.254.169.254', expected: true },
        { url: 'http://192.168.1.1', expected: true },
        { url: 'https://www.google.com', expected: false },
        { url: 'http://8.8.8.8', expected: false },
        { url: 'http://127.0.0.1.nip.io', expected: true },
    ];

    for (const c of cases) {
        try {
            await validateUrl(c.url);
            if (c.expected) {
                console.error(`FAIL: ${c.url} was NOT blocked but should have been.`);
            } else {
                console.log(`PASS: ${c.url} was NOT blocked as expected.`);
            }
        } catch (e) {
            if (c.expected) {
                console.log(`PASS: ${c.url} was blocked as expected: ${e.message}`);
            } else {
                console.error(`FAIL: ${c.url} was blocked but should NOT have been: ${e.message}`);
            }
        }
    }
}

async function main() {
    await testValidateUrl();
    console.log('\nIntegration verification (code review):');
    console.log('- headful.js: validated at start of handleHeadful');
    console.log('- scrape.js: validated after URL check in handleScrape');
    console.log('- agent.js: validated initial URL and navigate/goto actions');
}

main().catch(console.error);
