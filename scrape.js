const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getProxySelection } = require('./proxy-rotation');
const { selectUserAgent } = require('./user-agent-settings');
const { formatHTML } = require('./html-utils');

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

const parseBooleanFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return false;
    const normalized = String(value).toLowerCase();
    return normalized === 'true' || normalized === '1';
};

async function handleScrape(req, res) {
    const url = req.body.url || req.query.url;
    const customHeaders = req.body.headers || {};
    const userSelector = req.body.selector || req.query.selector;
    const waitInput = req.body.wait || req.query.wait;
    const waitTime = waitInput ? parseFloat(waitInput) * 1000 : 2000;
    const rotateUserAgents = req.body.rotateUserAgents || req.query.rotateUserAgents || false;
    const rotateViewportRaw = req.body.rotateViewport ?? req.query.rotateViewport;
    const rotateViewport = String(rotateViewportRaw).toLowerCase() === 'true' || rotateViewportRaw === true;
    const runId = req.body.runId || req.query.runId || null;
    const captureRunId = runId ? String(runId) : `run_${Date.now()}_unknown`;
    const rotateProxiesRaw = req.body.rotateProxies ?? req.query.rotateProxies;
    const rotateProxies = String(rotateProxiesRaw).toLowerCase() === 'true' || rotateProxiesRaw === true;
    const includeShadowDomRaw = req.body.includeShadowDom ?? req.query.includeShadowDom;
    const includeShadowDom = includeShadowDomRaw === undefined
        ? true
        : !(String(includeShadowDomRaw).toLowerCase() === 'false' || includeShadowDomRaw === false);
    const disableRecordingRaw = req.body.disableRecording ?? req.query.disableRecording;
    const disableRecording = parseBooleanFlag(disableRecordingRaw);
    const statelessExecutionRaw = req.body.statelessExecution ?? req.query.statelessExecution;
    const statelessExecution = parseBooleanFlag(statelessExecutionRaw);
    const extractionScript = req.body.extractionScript || req.query.extractionScript;
    const extractionFormat = (req.body.extractionFormat || req.query.extractionFormat) === 'csv' ? 'csv' : 'json';

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    console.log(`Scraping: ${url}`);

    const selectedUA = selectUserAgent(rotateUserAgents);

    let browser;
    let context;
    let page;
    try {
        // Use 'chrome' channel to use a real installed browser instead of default Chromium
        const launchOptions = {
            headless: true,
            channel: 'chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--hide-scrollbars',
                '--mute-audio'
            ]
        };
        const selection = getProxySelection(rotateProxies);
        if (selection.proxy) {
            launchOptions.proxy = selection.proxy;
        }
        console.log(`[PROXY] Mode: ${selection.mode}; Target: ${selection.proxy ? selection.proxy.server : 'host_ip'}`);
        browser = await chromium.launch(launchOptions);

        const recordingsDir = path.join(__dirname, 'data', 'recordings');
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }

        const viewport = rotateViewport
            ? { width: 1280 + Math.floor(Math.random() * 640), height: 720 + Math.floor(Math.random() * 360) }
            : { width: 1366, height: 768 };

        const contextOptions = {
            userAgent: selectedUA,
            extraHTTPHeaders: customHeaders,
            viewport,
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            colorScheme: 'dark',
            permissions: ['geolocation']
        };

        const shouldUseStorageState = !statelessExecution && fs.existsSync(STORAGE_STATE_FILE);
        if (shouldUseStorageState) {
            contextOptions.storageState = STORAGE_STATE_FILE;
        }

        if (!disableRecording) {
            contextOptions.recordVideo = { dir: recordingsDir, size: viewport };
        }

        context = await browser.newContext(contextOptions);

        // Manual WebDriver Patch
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        await context.addInitScript(() => {
            const cursorId = 'dg-cursor-overlay';
            const dotId = 'dg-click-dot';
            if (document.getElementById(cursorId)) return;
            const cursor = document.createElement('div');
            cursor.id = cursorId;
            cursor.style.cssText = [
                'position:fixed',
                'top:0',
                'left:0',
                'width:18px',
                'height:18px',
                'margin-left:-9px',
                'margin-top:-9px',
                'border:2px solid rgba(56,189,248,0.7)',
                'background:rgba(56,189,248,0.25)',
                'border-radius:50%',
                'box-shadow:0 0 10px rgba(56,189,248,0.6)',
                'pointer-events:none',
                'z-index:2147483647',
                'transform:translate3d(0,0,0)',
                'transition:transform 60ms ease-out'
            ].join(';');
            const dot = document.createElement('div');
            dot.id = dotId;
            dot.style.cssText = [
                'position:fixed',
                'top:0',
                'left:0',
                'width:10px',
                'height:10px',
                'margin-left:-5px',
                'margin-top:-5px',
                'background:rgba(239,68,68,0.9)',
                'border-radius:50%',
                'box-shadow:0 0 12px rgba(239,68,68,0.8)',
                'pointer-events:none',
                'z-index:2147483647',
                'opacity:0',
                'transform:translate3d(0,0,0) scale(0.6)',
                'transition:opacity 120ms ease, transform 120ms ease'
            ].join(';');
            document.documentElement.appendChild(cursor);
            document.documentElement.appendChild(dot);
            const move = (x, y) => {
                cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            };
            window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY), { passive: true });
            window.addEventListener('click', (e) => {
                dot.style.left = `${e.clientX}px`;
                dot.style.top = `${e.clientY}px`;
                dot.style.opacity = '1';
                dot.style.transform = 'translate3d(0,0,0) scale(1)';
                cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(0.65)`;
                setTimeout(() => {
                    dot.style.opacity = '0';
                    dot.style.transform = 'translate3d(0,0,0) scale(0.6)';
                    cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(1)`;
                }, 180);
            }, true);
        });
        if (includeShadowDom) {
            await context.addInitScript(() => {
                if (!Element.prototype.attachShadow) return;
                const original = Element.prototype.attachShadow;
                Element.prototype.attachShadow = function (init) {
                    const options = init ? { ...init, mode: 'open' } : { mode: 'open' };
                    return original.call(this, options);
                };
            });
        }

        page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Auto-scroll logic
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 400;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) { clearInterval(timer); resolve(); }
                }, 100);
            });
            window.scrollTo(0, 0);
        });

        await page.waitForTimeout(waitTime);

        let productHtml = '';
        let usedFallback = false;

        if (userSelector) {
            if (includeShadowDom) {
                productHtml = await page.evaluate((selector) => {
                    const stripUseless = (root) => {
                        const useless = root.querySelectorAll('script, style, svg, link, noscript');
                        useless.forEach(node => node.remove());
                    };

                    const cloneWithShadow = (root) => {
                        const clone = root.cloneNode(true);
                        const walkerOrig = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                        const walkerClone = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);

                        while (walkerOrig.nextNode() && walkerClone.nextNode()) {
                            const orig = walkerOrig.currentNode;
                            const cloned = walkerClone.currentNode;
                            if (orig.shadowRoot) {
                                const template = document.createElement('template');
                                template.setAttribute('data-shadowroot', 'open');
                                template.innerHTML = orig.shadowRoot.innerHTML;
                                cloned.appendChild(template);
                            }
                        }

                        stripUseless(clone);
                        return clone;
                    };

                    const elements = Array.from(document.querySelectorAll(selector));
                    return elements.map(el => cloneWithShadow(el).outerHTML).join('\n');
                }, userSelector);
            } else {
                productHtml = await page.$$eval(userSelector, (elements) => {
                    return elements.map(el => {
                        const useless = el.querySelectorAll('script, style, svg, link, noscript');
                        useless.forEach(node => node.remove());
                        return el.outerHTML;
                    }).join('\n');
                });
            }
            if (!productHtml || productHtml.trim() === '') usedFallback = true;
        } else {
            usedFallback = true;
        }

        if (usedFallback) {
            productHtml = await page.evaluate((withShadow) => {
                const stripUseless = (root) => {
                    const useless = root.querySelectorAll('script, style, svg, link, noscript');
                    useless.forEach(node => node.remove());
                };

                const cloneWithShadow = (root) => {
                    const clone = root.cloneNode(true);
                    const walkerOrig = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                    const walkerClone = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);

                    while (walkerOrig.nextNode() && walkerClone.nextNode()) {
                        const orig = walkerOrig.currentNode;
                        const cloned = walkerClone.currentNode;
                        if (orig.shadowRoot) {
                            const template = document.createElement('template');
                            template.setAttribute('data-shadowroot', 'open');
                            template.innerHTML = orig.shadowRoot.innerHTML;
                            cloned.appendChild(template);
                        }
                    }

                    stripUseless(clone);
                    return clone;
                };

                if (withShadow) {
                    return cloneWithShadow(document.body).innerHTML;
                }

                const body = document.body.cloneNode(true);
                stripUseless(body);
                return body.innerHTML;
            }, includeShadowDom);
        }

        const runExtractionScript = async (script, html, pageUrl) => {
            if (!script || typeof script !== 'string') return { result: undefined, logs: [] };

            return new Promise((resolve) => {
                const worker = spawn('node', [path.join(__dirname, 'extraction-worker.js')], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, NODE_ENV: 'production' } // Minimal env
                });

                let stdout = '';
                let stderr = '';

                const workerTimeout = 5000;
                const timer = setTimeout(() => {
                    worker.kill();
                    resolve({ result: 'Worker timed out', logs: [] });
                }, workerTimeout);

                worker.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                worker.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                worker.on('close', (code) => {
                    clearTimeout(timer);
                    if (code !== 0) {
                        resolve({ result: `Worker exited with code ${code}: ${stderr}`, logs: [] });
                        return;
                    }
                    try {
                        const output = JSON.parse(stdout);
                        resolve(output);
                    } catch (e) {
                        resolve({ result: `Worker output parse error: ${e.message}. Stdout: ${stdout}`, logs: [] });
                    }
                });

                worker.on('error', (err) => {
                     clearTimeout(timer);
                     resolve({ result: `Worker spawn error: ${err.message}`, logs: [] });
                });

                const input = JSON.stringify({
                    script,
                    html,
                    url: pageUrl,
                    includeShadowDom
                });

                worker.stdin.write(input);
                worker.stdin.end();
            });
        };

        const extraction = await runExtractionScript(extractionScript, productHtml, page.url());

        // Ensure the public/screenshots directory exists
        const capturesDir = path.join(__dirname, 'public', 'captures');
        if (!fs.existsSync(capturesDir)) {
            fs.mkdirSync(capturesDir, { recursive: true });
        }

        const screenshotName = `${captureRunId}_scrape_${Date.now()}.png`;
        const screenshotPath = path.join(capturesDir, screenshotName);
        try {
            await page.screenshot({ path: screenshotPath, fullPage: false });
        } catch (e) {
            console.error('Screenshot failed:', e.message);
        }

        const rawExtraction = extraction.result !== undefined ? extraction.result : (extraction.logs.length ? extraction.logs.join('\n') : undefined);
        const formattedExtraction = extractionFormat === 'csv' ? toCsvString(rawExtraction) : rawExtraction;

        const data = {
            title: await page.title(),
            url: page.url(),
            html: formatHTML(productHtml),
            data: formattedExtraction,
            is_partial: !usedFallback,
            selector_used: usedFallback ? (userSelector ? `${userSelector} (not found, using body)` : 'body (default)') : userSelector,
            links: await page.$$eval('a[href]', elements => {
                return elements.map(el => el.href).filter(href => href && href.startsWith('http'));
            }),
            screenshot_url: `/captures/${screenshotName}`
        };

        // Save session state
        if (!statelessExecution) {
            await context.storageState({ path: STORAGE_STATE_FILE });
        }

        const video = page.video();
        await context.close();
        if (video) {
            try {
                const videoPath = await video.path();
                if (videoPath && fs.existsSync(videoPath)) {
                    const recordingName = `${captureRunId}_scrape_${Date.now()}.webm`;
                    const recordingPath = path.join(capturesDir, recordingName);
                    try {
                        await fs.promises.rename(videoPath, recordingPath);
                    } catch (err) {
                        if (err && err.code === 'EXDEV') {
                            await fs.promises.copyFile(videoPath, recordingPath);
                            await fs.promises.unlink(videoPath);
                        } else {
                            throw err;
                        }
                    }
                }
            } catch (e) {
                console.error('Recording save failed:', e.message);
            }
        }

        await browser.close();
        res.json(data);
    } catch (error) {
        console.error('Scrape Error:', error);
        try {
            if (context) await context.close();
        } catch {}
        if (browser) await browser.close();
        res.status(500).json({ error: 'Failed to scrape', details: error.message });
    }
}

module.exports = { handleScrape };
