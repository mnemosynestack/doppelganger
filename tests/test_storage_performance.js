const fs = require('fs');
const path = require('path');
const os = require('os');

// Setup temp directory
const TEST_DIR = path.join(os.tmpdir(), 'bolt_test_' + Date.now());
fs.mkdirSync(TEST_DIR, { recursive: true });

// Set environment variable BEFORE requiring storage to override DATA_DIR
process.env.DATA_DIR = TEST_DIR;

console.log(`Running storage performance test in ${TEST_DIR}`);

// Require modules after setting env var
const { appendExecution, loadExecutions, saveExecutions } = require('../src/server/storage');
const { EXECUTIONS_FILE } = require('../src/server/constants');

async function testPerformance() {
    // 1. Warm up (ensure cache is initialized)
    await loadExecutions();

    // 2. Measure append performance (should be fast due to debouncing)
    const iterations = 100;
    const start = Date.now();

    console.log(`Appending ${iterations} executions...`);

    // We create a promise chain to simulate sequential requests,
    // although in real server they might be parallel.
    // Even sequentially, debouncing should make each call return instantly.
    for (let i = 0; i < iterations; i++) {
        await appendExecution({
            id: `exec_${i}`,
            timestamp: Date.now(),
            method: 'GET',
            path: '/test',
            status: 200,
            durationMs: 10,
            source: 'test',
            mode: 'test',
            result: { data: 'x'.repeat(1000) } // 1KB payload per entry
        });
    }

    const duration = Date.now() - start;
    console.log(`Appended ${iterations} executions in ${duration}ms`);

    // Threshold: 100 iterations.
    // Without debouncing: 100 * (write time ~2-5ms) = 200-500ms + overhead.
    // With debouncing: 100 * (overhead ~0.1ms) = 10ms.
    // We set a conservative threshold of 100ms.
    if (duration > 200) {
        console.warn('WARNING: Appending took longer than expected (200ms). Is debouncing working?');
    } else {
        console.log('PASS: Appending was fast (non-blocking).');
    }

    // 3. Verify eventual consistency
    console.log('Waiting for debounce flush (1.5s)...');
    await new Promise(r => setTimeout(r, 1500));

    if (!fs.existsSync(EXECUTIONS_FILE)) {
        throw new Error('executions.json was not created');
    }

    const content = fs.readFileSync(EXECUTIONS_FILE, 'utf8');
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        throw new Error('executions.json is corrupted: ' + e.message);
    }

    if (data.length !== iterations) {
        throw new Error(`Expected ${iterations} executions in file, found ${data.length}`);
    }

    console.log(`PASS: File contains all ${data.length} executions.`);

    // 4. Test forceful save (if needed) or just cleanup
    // We are done.
}

// Run test
testPerformance()
    .then(() => {
        console.log('All tests passed!');
        // Cleanup
        try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
    })
    .catch(err => {
        console.error('Test failed:', err);
        // Cleanup
        try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
        process.exit(1);
    });
