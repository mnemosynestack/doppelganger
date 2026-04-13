const net = require('net');
const dns = require('dns').promises;

async function testIp(ip) {
    console.log(`Testing IP: ${ip}`);
    console.log(`  net.isIP: ${net.isIP(ip)}`);
    console.log(`  net.isIPv4: ${net.isIPv4(ip)}`);
    try {
        const addr = await dns.lookup(ip, { all: true });
        console.log(`  dns.lookup: ${JSON.stringify(addr)}`);
    } catch (e) {
        console.log(`  dns.lookup error: ${e.message}`);
    }
}

async function run() {
    await testIp('127.0.0.1');
    await testIp('127.1');
    await testIp('2130706433');
    await testIp('0177.0.0.1');
    await testIp('0x7f.0.0.1');
}

run();
