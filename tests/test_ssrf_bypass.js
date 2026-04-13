const { validateUrl } = require('../url-utils');

async function test(url) {
    console.log(`Testing URL: ${url}`);
    try {
        await validateUrl(url);
        console.log(`  RESULT: ALLOWED (Vulnerable if it's a private IP!)`);
    } catch (e) {
        console.log(`  RESULT: BLOCKED (${e.message})`);
    }
}

async function run() {
    await test('http://127.0.0.1');
    await test('http://127.1');
    await test('http://2130706433');
    await test('http://0177.0.0.1');
    await test('http://0x7f.0.0.1');
    await test('http://[::1]');
    await test('http://[::ffff:7f00:1]');
}

run();
