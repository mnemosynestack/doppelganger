const csvEscape = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(text) || /^\s|\s$/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

const toCsvString = (raw) => {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return toCsvString(JSON.parse(trimmed));
            } catch {
                return raw;
            }
        }
        return raw;
    }
    const rows = Array.isArray(raw) ? raw : [raw];
    if (rows.length === 0) return '';

    const allKeys = [];
    rows.forEach((row) => {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
            Object.keys(row).forEach((key) => {
                if (!allKeys.includes(key)) allKeys.push(key);
            });
        }
    });

    if (allKeys.length === 0) {
        const lines = rows.map((row) => {
            if (Array.isArray(row)) return row.map(csvEscape).join(',');
            return csvEscape(row);
        });
        return lines.join('\n');
    }

    const headerLine = allKeys.map(csvEscape).join(',');
    const lines = rows.map((row) => {
        const obj = row && typeof row === 'object' ? row : {};
        return allKeys.map((key) => csvEscape(obj[key])).join(',');
    });
    return [headerLine, ...lines].join('\n');
};

const parseCsv = (input) => {
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

module.exports = { csvEscape, toCsvString, parseCsv };
