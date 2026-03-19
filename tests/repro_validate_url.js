const { validateUrl } = require('../url-utils');

async function test() {
    console.log('Testing validateUrl with file:// protocol...');
    try {
        await validateUrl('file:///etc/passwd');
        console.log('❌ Vulnerability confirmed: validateUrl allowed file:// protocol!');
        process.exit(1);
    } catch (e) {
        console.log('✅ validateUrl blocked file:// protocol: ' + e.message);
        process.exit(0);
    }
}

test();
