const { createSafeProxy, runExtractionScript } = require('../src/agent/sandbox');

async function runTest() {
    console.log('--- Sandbox Optimization Test ---');

    const mock = {
        nested: { value: 1 },
        fn: function() { return this.nested; }
    };
    const p = createSafeProxy(mock);

    // 1. Verify Identity Consistency
    console.log('Testing Identity Consistency...');
    const n1 = p.nested;
    const n2 = p.nested;
    const identityMatch = (n1 === n2);
    console.log('p.nested === p.nested:', identityMatch);
    if (!identityMatch) throw new Error('Identity consistency FAILED: Repeated property access returned different objects.');

    const fnResult = p.fn();
    const fnMatch = (fnResult === n1);
    console.log('p.fn() === p.nested:', fnMatch);
    if (!fnMatch) throw new Error('Function return identity consistency FAILED: Method returning same object returned different proxy.');

    // 2. Verify performance
    console.log('\nTesting Performance (100,000 accesses)...');
    const iterations = 100000;
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        const tmp = p.nested;
    }
    const end = Date.now();
    const duration = end - start;
    console.log(`Duration: ${duration}ms`);
    if (duration > 100) {
        console.warn('Performance is slower than expected (< 100ms), but identity is consistent.');
    } else {
        console.log('Performance is optimal.');
    }

    // 3. Integration Check (runExtractionScript)
    console.log('\nIntegration Check (runExtractionScript)...');
    const html = '<html><body><div id="test"></div></body></html>';
    const script = 'return window.document === window.document;';
    const result = await runExtractionScript(script, html, 'http://localhost', false);
    console.log('Sandbox window.document === window.document:', result.result);
    if (result.result !== true) throw new Error('Sandbox identity consistency integration FAILED');

    console.log('\nSUCCESS: All sandbox optimization checks passed.');
}

runTest().catch(err => {
    console.error('TEST FAILED:', err.message);
    process.exit(1);
});
