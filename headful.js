const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STORAGE_STATE_PATH = path.join(__dirname, 'storage_state.json');
const STORAGE_STATE_FILE = (() => {
    try {
        if (fs.existsSync(STORAGE_STATE_PATH)) {
            const stat = fs.statSync(STORAGE_STATE_PATH);
            if (stat.isDirectory()) {
                return path.join(STORAGE_STATE_PATH, 'storage_state.json');
            }
        }
    } catch {}
    return STORAGE_STATE_PATH;
})();

// Use a consistent User Agent or the same pool
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

let activeSession = null;

const teardownActiveSession = async () => {
    if (!activeSession) return;
    try {
        if (activeSession.interval) clearInterval(activeSession.interval);
    } catch {}
    try {
        if (activeSession.context) {
            await activeSession.context.storageState({ path: STORAGE_STATE_FILE });
        }
    } catch {}
    try {
        if (activeSession.browser) {
            await activeSession.browser.close();
        }
    } catch {}
    activeSession = null;
};

async function handleHeadful(req, res) {
    if (activeSession) {
        await teardownActiveSession();
    }

    activeSession = { status: 'starting', startedAt: Date.now() };

    const url = req.body.url || req.query.url || 'https://www.google.com';

    // We stick to the first UA in the list for headful mode to ensure consistency
    const selectedUA = userAgents[0];

    console.log(`Opening headful browser for: ${url}`);

    let browser;
    try {
        browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                '--window-size=1280,720',
                '--window-position=80,80'
            ]
        });

        const contextOptions = {
            viewport: null,
            userAgent: selectedUA,
            locale: 'en-US',
            timezoneId: 'America/New_York'
        };

        if (fs.existsSync(STORAGE_STATE_FILE)) {
            console.log('Loading existing storage state...');
            contextOptions.storageState = STORAGE_STATE_FILE;
        }

        const context = await browser.newContext(contextOptions);
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = window.chrome || { runtime: {} };
            window.open = (url) => {
                if (url) window.location.href = url;
                return window;
            };
            document.addEventListener('click', (event) => {
                const target = event.target;
                const anchor = target && target.closest ? target.closest('a[target="_blank"]') : null;
                if (anchor && anchor.href) {
                    event.preventDefault();
                    window.location.href = anchor.href;
                }
            }, true);
        });
        const page = await context.newPage();

        const closeIfExtra = async (extraPage) => {
            if (!extraPage || extraPage === page) return;
            try {
                await extraPage.close();
            } catch {}
        };

        context.on('page', closeIfExtra);
        page.on('popup', closeIfExtra);

        await page.goto(url);

        console.log('Browser is open. Please log in manually.');
        console.log('IMPORTANT: Close the page/tab or wait for saves.');

        // Function to save state
        const saveState = async () => {
            try {
                await context.storageState({ path: STORAGE_STATE_FILE });
                console.log('Storage state saved successfully.');
            } catch (e) {
                // If context is closed, this will fail, which is expected during shutdown
            }
        };

        // Auto-save every 10 seconds while the window is open
        const interval = setInterval(saveState, 10000);

        activeSession = { browser, context, interval, status: 'running', startedAt: activeSession.startedAt };

        // Save when the page is closed
        page.on('close', async () => {
            clearInterval(interval);
            await saveState();
        });

        // Respond immediately; cleanup runs after disconnect
        res.json({
            message: 'Headful session started. Close the browser window or call /headful/stop to end.',
            userAgentUsed: selectedUA,
            path: STORAGE_STATE_FILE
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
