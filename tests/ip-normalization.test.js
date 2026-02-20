const assert = require('assert');
const { normalizeIp, parseIpList } = require('../src/server/utils');

console.log('Testing IP normalization functions...');

// 1. Test normalizeIp
console.log('Testing normalizeIp...');

// Test empty/null input
assert.strictEqual(normalizeIp(null), '', 'Should return empty string for null');
assert.strictEqual(normalizeIp(undefined), '', 'Should return empty string for undefined');
assert.strictEqual(normalizeIp(''), '', 'Should return empty string for empty string');

// Test simple IPv4
assert.strictEqual(normalizeIp('127.0.0.1'), '127.0.0.1', 'Should handle simple IPv4');

// Test simple IPv6
assert.strictEqual(normalizeIp('::1'), '::1', 'Should handle simple IPv6');

// Test IPv4 mapped IPv6
assert.strictEqual(normalizeIp('::ffff:127.0.0.1'), '127.0.0.1', 'Should remove ::ffff: prefix');

// Test IPv6 with brackets
assert.strictEqual(normalizeIp('[::1]'), '::1', 'Should remove brackets from IPv6');

// Test IPv6 with Zone ID
assert.strictEqual(normalizeIp('fe80::1%eth0'), 'fe80::1', 'Should remove Zone ID');

// Test IPv6 with brackets and Zone ID (if logic allows)
// Based on implementation:
// 1. split(',') -> '[fe80::1%eth0]'
// 2. slice(1, -1) -> 'fe80::1%eth0'
// 3. split('%') -> 'fe80::1'
assert.strictEqual(normalizeIp('[fe80::1%eth0]'), 'fe80::1', 'Should handle brackets and Zone ID');

// Test comma-separated list
assert.strictEqual(normalizeIp('192.168.1.1, 10.0.0.1'), '192.168.1.1', 'Should take first IP from list');

// Test whitespace trimming
assert.strictEqual(normalizeIp('  127.0.0.1  '), '127.0.0.1', 'Should trim whitespace');
assert.strictEqual(normalizeIp('  192.168.1.1  , 10.0.0.1 '), '192.168.1.1', 'Should trim whitespace with list');

console.log('✓ normalizeIp tests passed');

// 2. Test parseIpList
console.log('Testing parseIpList...');

// Test empty/null input
assert.deepStrictEqual(parseIpList(null), [], 'Should return empty array for null');
assert.deepStrictEqual(parseIpList(undefined), [], 'Should return empty array for undefined');
assert.deepStrictEqual(parseIpList(''), [], 'Should return empty array for empty string');

// Test single string IP
assert.deepStrictEqual(parseIpList('127.0.0.1'), ['127.0.0.1'], 'Should handle single string IP');

// Test comma-separated string IPs
assert.deepStrictEqual(parseIpList('127.0.0.1, 192.168.1.1'), ['127.0.0.1', '192.168.1.1'], 'Should handle comma-separated IPs');

// Test array of strings
assert.deepStrictEqual(parseIpList(['127.0.0.1', '192.168.1.1']), ['127.0.0.1', '192.168.1.1'], 'Should handle array of strings');

// Test whitespace handling
assert.deepStrictEqual(parseIpList('  127.0.0.1  ,  192.168.1.1  '), ['127.0.0.1', '192.168.1.1'], 'Should trim whitespace in list');

// Test mixed types (should map to string)
assert.deepStrictEqual(parseIpList([123, '456']), ['123', '456'], 'Should map elements to strings if array');

console.log('✓ parseIpList tests passed');

console.log('All IP normalization tests passed successfully!');
