
const http = require('http');
const fs = require('fs');
const path = require('path');

// Read API key if available
let apiKey = '';
try {
    // Go up one level from scripts/ to root
    const apiKeyData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'api_key.json'), 'utf8'));
    apiKey = apiKeyData.apiKey;
} catch (e) {
    console.log('No API key found in data/api_key.json, checking users.json...');
    try {
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'users.json'), 'utf8'));
        if (users.length > 0) apiKey = users[0].apiKey;
    } catch (err) {
        console.log('No users found either.');
    }
}

if (!apiKey) {
    console.warn('WARNING: No API key found. Authentication tests might fail if strict auth is enabled.');
} else {
    console.log('Found API Key:', apiKey.substring(0, 5) + '...');
}

const makeRequest = (path, headers = {}) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 11345,
            path: path,
            method: 'GET',
            headers: headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
};

async function test() {
    console.log('--- Testing /api/executions/list ---');

    // Test 1: No API Key (Should be 403 or 401)
    try {
        const res1 = await makeRequest('/api/executions/list');
        console.log(`[Test 1] No API Key: Status ${res1.statusCode}`);
        if (res1.statusCode === 403 || res1.statusCode === 401) {
            console.log('PASS: Correctly rejected without key');
        } else {
            console.log('FAIL: Expected 403/401, got ' + res1.statusCode);
        }
    } catch (e) {
        console.log('FAIL: Connection error', e.message);
    }

    // Test 2: With API Key
    if (apiKey) {
        try {
            const res2 = await makeRequest('/api/executions/list', { 'x-api-key': apiKey });
            console.log(`[Test 2] With API Key: Status ${res2.statusCode}`);
            if (res2.statusCode === 200) {
                const data = JSON.parse(res2.body);
                if (data.executions && Array.isArray(data.executions)) {
                    console.log(`PASS: Retrieved ${data.executions.length} executions`);
                } else {
                    console.log('FAIL: Invalid response format', res2.body.substring(0, 100));
                }
            } else {
                console.log('FAIL: Expected 200, got ' + res2.statusCode);
                console.log('Body:', res2.body);
            }
        } catch (e) {
            console.log('FAIL: Connection error', e.message);
        }
    } else {
        console.log('[Test 2] Skipped: No API key available to test success case');
    }
}

test();
