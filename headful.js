const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getProxySelection } = require('./proxy-rotation');
const { selectUserAgent } = require('./user-agent-settings');
const { validateUrl } = require('./url-utils');
const { parseBooleanFlag } = require('./common-utils');
const { installMouseHelper } = require('./src/agent/dom-utils');

const STORAGE_STATE_PATH = path.join(__dirname, 'storage_state.json');
const STORAGE_STATE_FILE = (() => {
    try {
        if (fs.existsSync(STORAGE_STATE_PATH)) {
            const stat = fs.statSync(STORAGE_STATE_PATH);
            if (stat.isDirectory()) {
                return path.join(STORAGE_STATE_PATH, 'storage_state.json');
            }
        }
    } catch { }
    return STORAGE_STATE_PATH;
})();

let activeSession = null;

const teardownActiveSession = async () => {
    if (!activeSession) return;
    try {
        if (activeSession.interval) clearInterval(activeSession.interval);
    } catch { }
    try {
        if (activeSession.context && !activeSession.stateless) {
            await activeSession.context.storageState({ path: STORAGE_STATE_FILE });
        }
    } catch { }
    try {
        if (activeSession.browser) {
            await activeSession.browser.close();
        }
    } catch { }
    activeSession = null;
};

async function handleHeadful(req, res) {
    if (activeSession) {
        await teardownActiveSession();
    }

    const url = req.body.url || req.query.url || 'https://www.google.com';

    try {
        await validateUrl(url);
    } catch (e) {
        return res.status(400).json({ error: 'INVALID_URL', details: e.message });
    }

    const rotateProxiesRaw = req.body.rotateProxies ?? req.query.rotateProxies;
    const rotateProxies = String(rotateProxiesRaw).toLowerCase() === 'true' || rotateProxiesRaw === true;
    const statelessExecutionRaw = req.body.statelessExecution ?? req.query.statelessExecution;
    const statelessExecution = parseBooleanFlag(statelessExecutionRaw);

    activeSession = { status: 'starting', startedAt: Date.now(), stateless: statelessExecution };

    const selectedUA = await selectUserAgent(false);

    console.log(`Opening headful browser for: ${url}`);

    let browser;
    try {
        const launchOptions = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
                '--window-position=0,0'
            ]
        };
        const selection = getProxySelection(rotateProxies);
        if (selection.proxy) {
            launchOptions.proxy = selection.proxy;
        }
        console.log(`[PROXY] Mode: ${selection.mode}; Target: ${selection.proxy ? selection.proxy.server : 'host_ip'}`);
        browser = await chromium.launch(launchOptions);

        const contextOptions = {
            viewport: null,
            userAgent: selectedUA,
            locale: 'en-US',
            timezoneId: 'America/New_York'
        };

        if (!statelessExecution && fs.existsSync(STORAGE_STATE_FILE)) {
            console.log('Loading existing storage state...');
            contextOptions.storageState = STORAGE_STATE_FILE;
        }

        const context = await browser.newContext(contextOptions);
        await context.addInitScript(() => {
            window.open = () => null;
            document.addEventListener('click', (event) => {
                const target = event.target;
                const anchor = target && target.closest ? target.closest('a[target="_blank"]') : null;
                if (anchor) {
                    event.preventDefault();
                }
            }, true);
        });
        await context.addInitScript(installMouseHelper);

        const page = await context.newPage();

        const closeIfExtra = async (extraPage) => {
            if (!extraPage || extraPage === page) return;
            try {
                await extraPage.close();
            } catch { }
        };

        context.on('page', closeIfExtra);
        page.on('popup', closeIfExtra);

        await page.goto(url);

        console.log('Browser is open. Please log in manually.');
        console.log('IMPORTANT: Close the page/tab or wait for saves.');

        // Function to save state
        const saveState = async () => {
            if (statelessExecution) return;
            try {
                await context.storageState({ path: STORAGE_STATE_FILE });
                console.log('Storage state saved successfully.');
            } catch (e) {
                // If context is closed, this will fail, which is expected during shutdown
            }
        };

        // Auto-save every 10 seconds while the window is open
        const interval = setInterval(saveState, 10000);

        activeSession = { browser, context, interval, status: 'running', startedAt: activeSession.startedAt, stateless: statelessExecution };

        // Save when the page is closed
        page.on('close', async () => {
            clearInterval(interval);
            await saveState();
        });

        // Respond immediately; cleanup runs after disconnect
        res.json({
            message: 'Headful session started. Close the browser window or call /headful/stop to end.',
            userAgentUsed: selectedUA,
            path: statelessExecution ? null : STORAGE_STATE_FILE
        });

        // Wait for the browser to disconnect (user closes the last window)
        await new Promise((resolve) => browser.on('disconnected', resolve));

        clearInterval(interval);

        // Final attempt to save if context is alive
        await saveState();
        activeSession = null;
    } catch (error) {
        console.error('Headful Error:', error);
        if (browser) await browser.close();
        activeSession = null;
        const message = String(error && error.message ? error.message : error);
        const displayUnavailable = /missing x server|\$display|platform failed to initialize/i.test(message);
        if (!res.headersSent && displayUnavailable) {
            return res.status(409).json({ error: 'HEADFUL_DISPLAY_UNAVAILABLE', details: message });
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start headful session', details: message });
        }
    }
}

async function stopHeadful(req, res) {
    if (!activeSession) {
        return res.status(200).json({ message: 'No active headful session.' });
    }

    await teardownActiveSession();
    res.json({ message: 'Headful session stopped.' });
}

module.exports = { handleHeadful, stopHeadful };
