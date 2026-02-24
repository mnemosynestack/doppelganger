const assert = require('assert');

// Enforce blocking for tests
process.env.ALLOW_PRIVATE_NETWORKS = 'false';

const { isPrivateIP, validateUrl } = require('../url-utils');

console.log('Testing isPrivateIP...');

const ipv4Cases = [
    { ip: '127.0.0.1', expected: true },
    { ip: '10.0.0.1', expected: true },
    { ip: '172.16.0.1', expected: true },
    { ip: '172.31.255.255', expected: true },
    { ip: '192.168.1.1', expected: true },
    { ip: '169.254.1.1', expected: true },
    { ip: '0.0.0.0', expected: true },
    { ip: '100.64.0.1', expected: true },
    { ip: '100.127.255.255', expected: true },
    { ip: '8.8.8.8', expected: false },
    { ip: '1.1.1.1', expected: false },
    { ip: '172.32.0.1', expected: false },
    { ip: '100.128.0.1', expected: false },
];

for (const { ip, expected } of ipv4Cases) {
    assert.strictEqual(isPrivateIP(ip), expected, `Failed for IPv4: ${ip}`);
}
console.log('✓ IPv4 cases passed');

const ipv6Cases = [
    { ip: '::1', expected: true },
    { ip: 'fe80::1', expected: true },
    { ip: 'fc00::', expected: true },
    { ip: 'fd00::', expected: true },
    { ip: '::', expected: true },
    { ip: '0:0:0:0:0:0:0:0', expected: true },
    { ip: '::ffff:127.0.0.1', expected: true },
    { ip: '::ffff:7f00:1', expected: true },
    { ip: '::ffff:192.168.1.1', expected: true },
    { ip: '::ffff:c0a8:101', expected: true },
    { ip: '::ffff:8.8.8.8', expected: false },
    { ip: '2606:4700:4700::1111', expected: false },
    { ip: '2001:4860:4860::8888', expected: false },
];

for (const { ip, expected } of ipv6Cases) {
    assert.strictEqual(isPrivateIP(ip), expected, `Failed for IPv6: ${ip}`);
}
console.log('✓ IPv6 cases passed');

async function testValidateUrl() {
    console.log('\nTesting validateUrl...');
    const urlCases = [
        { url: 'http://localhost', expectedBlock: true },
        { url: 'http://127.0.0.1', expectedBlock: true },
        { url: 'http://[::1]', expectedBlock: true },
        { url: 'http://[fe80::1]', expectedBlock: true },
        { url: 'http://[::]', expectedBlock: true },
        { url: 'http://[::ffff:127.0.0.1]', expectedBlock: true },
        { url: 'http://0.0.0.0', expectedBlock: true },
        { url: 'https://www.google.com', expectedBlock: false },
    ];

    for (const { url, expectedBlock } of urlCases) {
        let blocked = false;
        let errorMsg = '';
        try {
            await validateUrl(url);
        } catch (e) {
            blocked = true;
            errorMsg = e.message;
        }

        if (blocked !== expectedBlock) {
            throw new Error(`URL ${url} block status mismatch. Expected block: ${expectedBlock}, Actual block: ${blocked}. Error: ${errorMsg}`);
        }
        console.log(`  PASS: ${url} ${blocked ? 'blocked: ' + errorMsg : 'allowed'}`);
    }
}

testValidateUrl().then(() => {
    console.log('✓ validateUrl tests completed');
    console.log('\nAll url-utils tests finished successfully!');
}).catch(err => {
    console.error('\nTests failed:');
    console.error(err.message);
    process.exit(1);
});
