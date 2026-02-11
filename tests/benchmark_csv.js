
const assert = require('assert');
const { parseCsv } = require('../common-utils');

// Original implementation from agent.js
const parseCsvOriginal = (input) => {
    const text = typeof input === 'string' ? input : String(input || '');
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(current);
                current = '';
            } else if (char === '\n') {
                row.push(current);
                rows.push(row);
                row = [];
                current = '';
            } else if (char === '\r') {
                // ignore CR (handle CRLF)
            } else {
                current += char;
            }
        }
    }
    row.push(current);
    if (row.length > 1 || row[0] !== '' || rows.length > 0) rows.push(row);

    if (rows.length === 0) return [];
    const header = rows[0].map((cell, idx) => {
        const trimmed = String(cell || '').trim();
        return trimmed || `column_${idx + 1}`;
    });
    const dataRows = rows.slice(1);
    return dataRows.map((cells) => {
        const obj = {};
        header.forEach((key, idx) => {
            obj[key] = cells[idx] ?? '';
        });
        return obj;
    });
};

// Optimized using Regex loop which is often faster in V8
const parseCsvOptimized = (input) => {
    const text = typeof input === 'string' ? input : String(input || '');
    const len = text.length;
    const rows = [];
    let row = [];

    // Pattern to find next special char: " , \n \r
    const specialChar = /[",\n\r]/g;

    let current = '';
    let inQuotes = false;
    let match;

    let i = 0;

    while (i < len) {
        if (inQuotes) {
            // Find next quote
            let nextQuote = text.indexOf('"', i);
            if (nextQuote === -1) {
                // No more quotes, consume rest as content
                current += text.slice(i);
                i = len;
                break;
            }
            // We found a quote
            current += text.slice(i, nextQuote);
            i = nextQuote;

            // Check if escaped
            if (i + 1 < len && text[i + 1] === '"') {
                current += '"';
                i += 2; // skip both quotes
            } else {
                inQuotes = false;
                i += 1; // skip closing quote
            }
        } else {
            // Find next special char
            specialChar.lastIndex = i;
            match = specialChar.exec(text);

            if (!match) {
                current += text.slice(i);
                i = len;
                break;
            }

            const idx = match.index;
            const char = match[0];

            current += text.slice(i, idx);
            i = idx; // Position at the special char

            if (char === '"') {
                inQuotes = true;
                i += 1;
            } else if (char === ',') {
                row.push(current);
                current = '';
                i += 1;
            } else if (char === '\n') {
                row.push(current);
                rows.push(row);
                row = [];
                current = '';
                i += 1;
            } else if (char === '\r') {
                // ignore
                i += 1;
            }
        }
    }

    row.push(current);
    if (row.length > 1 || row[0] !== '' || rows.length > 0) rows.push(row);

    if (rows.length === 0) return [];

    const header = rows[0].map((cell, idx) => {
        const trimmed = String(cell || '').trim();
        return trimmed || `column_${idx + 1}`;
    });
    const dataRows = rows.slice(1);
    return dataRows.map((cells) => {
        const obj = {};
        header.forEach((key, idx) => {
            obj[key] = cells[idx] ?? '';
        });
        return obj;
    });
};

function verify(impl, name) {
    const input = 'a,b,c\n1,2,3\n"foo","bar","baz"\n"foo""bar",test,"multi\nline"';
    try {
        const res = impl(input);
        assert.strictEqual(res.length, 3); // 3 data rows (first is header)
        assert.strictEqual(res[0]['a'], '1');
        assert.strictEqual(res[1]['a'], 'foo');
        assert.strictEqual(res[1]['b'], 'bar');
        assert.strictEqual(res[2]['a'], 'foo"bar');
        assert.strictEqual(res[2]['c'], 'multi\nline');
        console.log(`Verification passed for ${name}`);
    } catch (e) {
        console.error(`Verification FAILED for ${name}:`, e);
        process.exit(1);
    }
}

function benchmark() {
    // Generate large CSV
    const rows = [];
    rows.push('id,name,description,value,is_active');
    for (let i = 0; i < 50000; i++) {
        rows.push(`${i},"Name ${i}","Description with "quotes" and, commas",${Math.random()},${i%2===0}`);
    }
    const input = rows.join('\n');
    console.log(`Generated CSV with ${input.length} characters.`);

    const start1 = performance.now();
    parseCsvOriginal(input);
    const end1 = performance.now();
    console.log(`Original: ${(end1 - start1).toFixed(2)}ms`);

    const start2 = performance.now();
    parseCsvOptimized(input);
    const end2 = performance.now();
    console.log(`Optimized (Regex/Slice): ${(end2 - start2).toFixed(2)}ms`);

    // Correctness check on large input
    const res1 = parseCsvOriginal(input);
    const res2 = parseCsvOptimized(input);
    assert.deepStrictEqual(res1, res2, "Results match on large input");
    console.log("Results match!");
}

verify(parseCsvOriginal, "Original");
verify(parseCsvOptimized, "Optimized");
verify(parseCsv, "CommonUtils");
benchmark();
