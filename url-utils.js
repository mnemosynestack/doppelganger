const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IP address is private.
 * @param {string} ip The IP address to check.
 * @returns {boolean} True if the IP is private.
 */
function isPrivateIP(ip) {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        return (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            parts[0] === 127 ||
            (parts[0] === 169 && parts[1] === 254)
        );
    }
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        // ::1 loopback, fe80:: link-local, fc00::/fd00:: unique local
        return (
            lower === '::1' ||
            lower.startsWith('fe80:') ||
            lower.startsWith('fc') ||
            lower.startsWith('fd')
        );
    }
    return false;
}

/**
 * Validates a URL to prevent SSRF by blocking private IP ranges.
 * @param {string} urlStr The URL to validate.
 * @throws {Error} If the URL is invalid or points to a private network.
 */
async function validateUrl(urlStr) {
    if (!urlStr) return;

    let url;
    try {
        url = new URL(urlStr);
    } catch (e) {
        throw new Error('Invalid URL');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    const hostname = url.hostname;

    // Direct check for common private hostnames
    const lowerHost = hostname.toLowerCase();
    if (lowerHost === 'localhost' || lowerHost.endsWith('.localhost')) {
        throw new Error('Access to private network is restricted');
    }

    // Resolve hostname to IP
    try {
        // dns.lookup follows /etc/hosts and is what's typically used for connecting
        const addresses = await dns.lookup(hostname, { all: true });
        for (const addr of addresses) {
            if (isPrivateIP(addr.address)) {
                throw new Error('Access to private network is restricted');
            }
        }
    } catch (e) {
        // If it's already an IP address, check it directly
        if (net.isIP(hostname)) {
            if (isPrivateIP(hostname)) {
                throw new Error('Access to private network is restricted');
            }
        }

        // Rethrow if it's the specific restricted error
        if (e.message === 'Access to private network is restricted') {
            throw e;
        }

        // If we can't resolve it and it's not an IP, we allow it to proceed
        // to the browser where it will likely fail normally.
    }
}

module.exports = { validateUrl, isPrivateIP };
