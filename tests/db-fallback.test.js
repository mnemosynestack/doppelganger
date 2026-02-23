const { initDB } = require('../src/server/db');

async function runTests() {
    process.env.SESSION_SECRET = 'test_secret';

    console.log('--- Test 1: No DB vars provided ---');
    try {
        const pool = await initDB();
        if (pool === null) {
            console.log('SUCCESS: initDB returned null (fallback to disk).');
        } else {
            console.error('FAIL: initDB should return null when no vars provided.');
        }
    } catch (e) {
        console.error('FAIL: initDB threw an unexpected error:', e.message);
    }

    // reset initDB state
    require('../src/server/db').__proto__.initialized = false;
    // but we can't easily reset module state, so let's just create a new process or use storage ensureDB?
}

runTests();
