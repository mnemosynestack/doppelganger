const assert = require('node:assert');
const { validateUrl } = require('../url-utils');

async function testSSRFDefaultProtection() {
    console.log('Testing SSRF default protection (ALLOW_PRIVATE_NETWORKS should be false)...');

    // Test localhost
    try {
        await validateUrl('http://localhost');
        assert.fail('Should have thrown an error for localhost');
    } catch (e) {
        assert.strictEqual(e.message, 'Access to private network is restricted');
        console.log('✅ localhost blocked as expected');
    }

    // Test 127.0.0.1
    try {
        await validateUrl('http://127.0.0.1');
        assert.fail('Should have thrown an error for 127.0.0.1');
    } catch (e) {
        assert.strictEqual(e.message, 'Access to private network is restricted');
        console.log('✅ 127.0.0.1 blocked as expected');
    }

    // Test private IP
    try {
        await validateUrl('http://192.168.1.1');
        assert.fail('Should have thrown an error for private IP');
    } catch (e) {
        assert.strictEqual(e.message, 'Access to private network is restricted');
        console.log('✅ 192.168.1.1 blocked as expected');
    }

    // Test public IP (google.com)
    try {
        const url = 'https://www.google.com/';
        const validated = await validateUrl(url);
        assert.strictEqual(validated, url);
        console.log('✅ public URL allowed as expected');
    } catch (e) {
        console.error('FAILED: public URL should be allowed', e);
        throw e;
    }

    console.log('All SSRF protection tests passed!');
}

testSSRFDefaultProtection().catch(err => {
    console.error('Test FAILED:', err);
    process.exit(1);
});
