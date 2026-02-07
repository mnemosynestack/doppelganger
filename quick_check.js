const { spawn } = require('child_process');
const PORT = 11348;
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
    const env = { ...process.env, PORT: String(PORT), NODE_ENV: 'production', SESSION_SECRET: 'test' };
    const server = spawn('node', ['server.js'], { env, stdio: 'pipe' });
    let serverStarted = false;
    server.stdout.on('data', d => { if (d.toString().includes('Server running')) serverStarted = true; });
    console.log('Waiting...');
    while (!serverStarted) await sleep(100);
    console.log('Started.');

    // Create user
    await fetch(`http://localhost:${PORT}/api/auth/setup`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name:'T',email:'t@t.com',password:'p'})
    });
    // Login
    const res = await fetch(`http://localhost:${PORT}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email:'t@t.com',password:'p'})
    });
    const cookie = res.headers.get('set-cookie');
    const headers = {Cookie:cookie};

    // Test Load
    const r1 = await fetch(`http://localhost:${PORT}/api/executions`, {headers});
    console.log('Load:', r1.status);

    // Test Append (via registerExecution simulation? No, just verify Load works for now)

    server.kill();
}
main().catch(e => console.error(e));
