const assert = require('assert');
const { parseBooleanFlag, csvEscape, toCsvString, parseCsv } = require('../common-utils');

function testParseBooleanFlag() {
    console.log('Testing parseBooleanFlag...');
    assert.strictEqual(parseBooleanFlag(true), true);
    assert.strictEqual(parseBooleanFlag(false), false);
    assert.strictEqual(parseBooleanFlag('true'), true);
    assert.strictEqual(parseBooleanFlag('TRUE'), true);
    assert.strictEqual(parseBooleanFlag('1'), true);
    assert.strictEqual(parseBooleanFlag('false'), false);
    assert.strictEqual(parseBooleanFlag('0'), false);
    assert.strictEqual(parseBooleanFlag('random'), false);
    assert.strictEqual(parseBooleanFlag(undefined), false);
    assert.strictEqual(parseBooleanFlag(null), false);
    assert.strictEqual(parseBooleanFlag(1), true); // Number 1 is also true because String(1) is '1'
    console.log('parseBooleanFlag tests passed!');
}

function testCsvEscape() {
    console.log('Testing csvEscape...');
    assert.strictEqual(csvEscape('simple'), 'simple');
    assert.strictEqual(csvEscape('with,comma'), '"with,comma"');
    assert.strictEqual(csvEscape('with"quote'), '"with""quote"');
    assert.strictEqual(csvEscape('with\nnewline'), '"with\nnewline"');
    assert.strictEqual(csvEscape(undefined), '');
    assert.strictEqual(csvEscape(null), '');
    console.log('csvEscape tests passed!');
}

function testToCsvString() {
    console.log('Testing toCsvString...');
    const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
    ];
    const expected = 'name,age\nJohn,30\nJane,25';
    assert.strictEqual(toCsvString(data), expected);

    const dataWithQuotes = [
        { name: 'John "Doe"', city: 'New York, NY' }
    ];
    const expectedWithQuotes = 'name,city\n"John ""Doe""","New York, NY"';
    assert.strictEqual(toCsvString(dataWithQuotes), expectedWithQuotes);
    console.log('toCsvString tests passed!');
}

function testParseCsv() {
    console.log('Testing parseCsv...');
    const input = 'name,age\nJohn,30\nJane,25';
    const expected = [
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' }
    ];
    assert.deepStrictEqual(parseCsv(input), expected);

    const inputWithQuotes = 'name,city\n"John ""Doe""","New York, NY"';
    const expectedWithQuotes = [
        { name: 'John "Doe"', city: 'New York, NY' }
    ];
    assert.deepStrictEqual(parseCsv(inputWithQuotes), expectedWithQuotes);
    console.log('parseCsv tests passed!');
}

try {
    testParseBooleanFlag();
    testCsvEscape();
    testToCsvString();
    testParseCsv();
    console.log('All tests passed successfully!');
} catch (e) {
    console.error('Tests failed!');
    console.error(e);
    process.exit(1);
}
