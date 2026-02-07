const fs = require('fs');
const path = require('path');

const CAPTURES_DIR = path.join(__dirname, 'public', 'captures');

/**
 * Ensures that the public/captures directory exists.
 * @returns {string} The absolute path to the captures directory.
 */
function ensureCapturesDir() {
    if (!fs.existsSync(CAPTURES_DIR)) {
        fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    }
    return CAPTURES_DIR;
}

module.exports = { ensureCapturesDir };
