const assert = require('assert');
const EventEmitter = require('events');

function getModule() {
    delete require.cache[require.resolve('../src/server/execution-queue')];
    return require('../src/server/execution-queue');
}

async function testUnlimitedMode() {
    console.log('Testing Unlimited Mode...');
    process.env.MAX_CONCURRENT_EXECUTIONS = '0';
    const { acquire, getStatus } = getModule();

    const status = getStatus();
    assert.strictEqual(status.maxConcurrent, 'unlimited');
    assert.strictEqual(status.active, 0);
    assert.strictEqual(status.queued, 0);

    const release1 = await acquire();
    const release2 = await acquire();

    assert.strictEqual(typeof release1, 'function');
    assert.strictEqual(typeof release2, 'function');

    const statusAfter = getStatus();
    assert.strictEqual(statusAfter.active, 0, 'Active count should remain 0 in unlimited mode');

    release1();
    release2();
    console.log('✓ Unlimited Mode passed');
}

async function testLimitedMode() {
    console.log('Testing Limited Mode (MAX=2)...');
    process.env.MAX_CONCURRENT_EXECUTIONS = '2';
    const { acquire, getStatus } = getModule();

    const status = getStatus();
    assert.strictEqual(status.maxConcurrent, 2);

    const release1 = await acquire();
    const release2 = await acquire();

    assert.strictEqual(getStatus().active, 2);
    assert.strictEqual(getStatus().queued, 0);

    let resolved3 = false;
    const p3 = acquire().then(rel => {
        resolved3 = true;
        return rel;
    });

    // Wait a bit to ensure p3 doesn't resolve immediately
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(resolved3, false, 'Third request should be queued');
    assert.strictEqual(getStatus().queued, 1);

    release1();
    const release3 = await p3;
    assert.strictEqual(resolved3, true, 'Third request should resolve after release1');
    assert.strictEqual(getStatus().active, 2);
    assert.strictEqual(getStatus().queued, 0);

    release2();
    assert.strictEqual(getStatus().active, 1);

    release3();
    assert.strictEqual(getStatus().active, 0);
    console.log('✓ Limited Mode passed');
}

async function testMiddleware() {
    console.log('Testing concurrencyGate Middleware...');
    process.env.MAX_CONCURRENT_EXECUTIONS = '1';
    const { concurrencyGate, getStatus } = getModule();

    const req = {};
    const res = new EventEmitter();
    res.locals = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    concurrencyGate(req, res, next);

    // Wait for acquire to resolve
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(nextCalled, true, 'next() should be called');
    assert.strictEqual(getStatus().active, 1);
    assert.strictEqual(typeof res.locals._releaseExecution, 'function');

    // Simulate response finish
    res.emit('finish');
    assert.strictEqual(getStatus().active, 0, 'Should release on finish');

    // Test double release
    res.emit('finish');
    assert.strictEqual(getStatus().active, 0, 'Should not decrement below 0 (double release)');

    // Test close event
    const res2 = new EventEmitter();
    res2.locals = {};
    concurrencyGate(req, res2, next);
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(getStatus().active, 1);
    res2.emit('close');
    assert.strictEqual(getStatus().active, 0, 'Should release on close');

    console.log('✓ Middleware passed');
}

async function runTests() {
    try {
        await testUnlimitedMode();
        await testLimitedMode();
        await testMiddleware();
        console.log('\nAll execution-queue tests passed!');
    } catch (err) {
        console.error('\nTests failed:');
        console.error(err);
        process.exit(1);
    }
}

runTests();
