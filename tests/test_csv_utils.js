const { csvEscape, toCsvString, parseCsv } = require('../csv-utils');
const assert = require('assert');

// Test csvEscape
console.log('Testing csvEscape...');
assert.strictEqual(csvEscape('abc'), 'abc');
assert.strictEqual(csvEscape('a,b'), '"a,b"');
assert.strictEqual(csvEscape('a"b'), '"a""b"');
assert.strictEqual(csvEscape('a\nb'), '"a\nb"');
assert.strictEqual(csvEscape(' a'), '" a"');
assert.strictEqual(csvEscape('a '), '"a "');
assert.strictEqual(csvEscape(undefined), '');
assert.strictEqual(csvEscape(null), '');
assert.strictEqual(csvEscape(123), '123');
console.log('csvEscape passed.');

// Test toCsvString
console.log('Testing toCsvString...');
assert.strictEqual(toCsvString(undefined), '');
assert.strictEqual(toCsvString(null), '');
assert.strictEqual(toCsvString([]), '');
assert.strictEqual(toCsvString('abc'), 'abc');
assert.strictEqual(toCsvString('{"a":1}'), 'a\n1');
assert.strictEqual(toCsvString('[{"a":1},{"a":2}]'), 'a\n1\n2');

const data1 = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
assert.strictEqual(toCsvString(data1), 'a,b\n1,2\n3,4');

const data2 = [{ a: '1,2', b: '3"4' }];
assert.strictEqual(toCsvString(data2), 'a,b\n"1,2","3""4"');

const data3 = [1, 2, 3];
assert.strictEqual(toCsvString(data3), '1\n2\n3');

const data4 = [['a', 'b'], [1, 2]];
assert.strictEqual(toCsvString(data4), 'a,b\n1,2');

console.log('toCsvString passed.');

// Test parseCsv
console.log('Testing parseCsv...');
const csv1 = 'a,b\n1,2\n3,4';
const parsed1 = parseCsv(csv1);
assert.deepStrictEqual(parsed1, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);

const csv2 = 'a,b\n"1,2","3""4"';
const parsed2 = parseCsv(csv2);
assert.deepStrictEqual(parsed2, [{ a: '1,2', b: '3"4' }]);

const csv3 = 'col1\nval1';
const parsed3 = parseCsv(csv3);
assert.deepStrictEqual(parsed3, [{ col1: 'val1' }]);

const csv4 = '';
const parsed4 = parseCsv(csv4);
assert.deepStrictEqual(parsed4, []);

const csv5 = 'a,b,c\n1,2';
const parsed5 = parseCsv(csv5);
assert.deepStrictEqual(parsed5, [{ a: '1', b: '2', c: '' }]);

console.log('parseCsv passed.');

console.log('All tests passed.');
