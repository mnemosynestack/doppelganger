const { getNextRun } = require('../src/server/cron-parser');

const start = Date.now();
try {
    // Jan 1st 2023 00:01 -> Next yearly run is Jan 1st 2024 00:00
    const next = getNextRun('0 0 1 1 *', new Date('2023-01-01T00:01:00Z'));
    console.log('Next run:', next.toISOString());
} catch (e) {
    console.error(e);
}
const end = Date.now();
console.log('Time taken:', end - start, 'ms');
