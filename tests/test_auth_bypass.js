const { requireApiKey } = require('../src/server/middleware');

async function testBypass() {
    const mockRes = {
        status: (code) => {
            console.log(`Response Status: ${code}`);
            return mockRes;
        },
        json: (data) => {
            console.log(`Response Body: ${JSON.stringify(data)}`);
            return mockRes;
        }
    };

    const next = () => console.log('Bypass Successful! (next() called)');

    console.log('Testing with spoofed IP (req.ip = 127.0.0.1, but external remoteAddress)');
    const req1 = {
        get: (h) => h.toLowerCase() === 'x-internal-run' ? '1' : null,
        ip: '127.0.0.1',
        socket: { remoteAddress: '8.8.8.8' }
    };
    await requireApiKey(req1, mockRes, next);

    console.log('\nTesting with legitimate loopback (req.ip = 127.0.0.1 AND remoteAddress = 127.0.0.1)');
    const req2 = {
        get: (h) => h.toLowerCase() === 'x-internal-run' ? '1' : null,
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' }
    };
    await requireApiKey(req2, mockRes, next);
}

testBypass();
