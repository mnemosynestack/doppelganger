const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { getProxySelection } = require('./proxy-rotation');
const { selectUserAgent } = require('./user-agent-settings');

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

const API_KEY_FILE = path.join(__dirname, 'data', 'api_key.json');

const loadApiKey = () => {
    if (!fs.existsSync(API_KEY_FILE)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(API_KEY_FILE, 'utf8'));
        return data && data.apiKey ? data.apiKey : null;
    } catch {
        return null;
    }
};

let progressReporter = null;
let stopChecker = null;

const setProgressReporter = (reporter) => {
    progressReporter = reporter;
};

const reportProgress = (runId, payload) => {
    if (!runId || typeof progressReporter !== 'function') return;
    try {
        progressReporter(runId, payload);
    } catch {
        // ignore
    }
};

const setStopChecker = (checker) => {
    stopChecker = checker;
};

const isStopRequested = (runId) => {
    if (!runId || typeof stopChecker !== 'function') return false;
    try {
        return !!stopChecker(runId);
    } catch {
        return false;
    }
};

async function moveMouseHumanlike(page, targetX, targetY) {
    const steps = 8 + Math.floor(Math.random() * 6);
    const startX = targetX + (Math.random() - 0.5) * 120;
    const startY = targetY + (Math.random() - 0.5) * 120;
    const ctrlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 80;
    const ctrlY = (startY + targetY) / 2 + (Math.random() - 0.5) * 80;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const inv = 1 - t;
        const curveX = inv * inv * startX + 2 * inv * t * ctrlX + t * t * targetX;
        const curveY = inv * inv * startY + 2 * inv * t * ctrlY + t * t * targetY;
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        await page.mouse.move(curveX + jitterX, curveY + jitterY, { steps: 1 });
    }
}

async function idleMouse(page) {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const drifts = 3 + Math.floor(Math.random() * 3);
    let x = Math.random() * viewport.width;
    let y = Math.random() * viewport.height;
    for (let i = 0; i < drifts; i++) {
        const targetX = Math.random() * viewport.width;
        const targetY = Math.random() * viewport.height;
        const steps = 20 + Math.floor(Math.random() * 20);
        for (let s = 0; s < steps; s++) {
            x += (targetX - x) / (steps - s);
            y += (targetY - y) / (steps - s);
            await page.mouse.move(x, y, { steps: 1 });
        }
        if (Math.random() < 0.4) {
            await page.waitForTimeout(200 + Math.random() * 600);
        }
    }
}

async function overshootScroll(page, targetY) {
    const overshoot = (Math.random() > 0.5 ? 1 : -1) * (40 + Math.floor(Math.random() * 120));
    const smoothTarget = targetY + overshoot;

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), smoothTarget);
    await page.waitForTimeout(250 + Math.random() * 400);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), targetY);
    if (Math.random() < 0.35) {
        await page.waitForTimeout(120 + Math.random() * 200);
        await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), (Math.random() - 0.5) * 60);
    }
}

const punctuationPause = /[.,!?;:]/;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const parseBooleanFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return false;
    const normalized = String(value).toLowerCase();
    return normalized === 'true' || normalized === '1';
};

async function humanType(page, selector, text, options = {}) {
    const { allowTypos = false, naturalTyping = false, fatigue = false } = options;
    if (selector) await page.focus(selector);
    const chars = text.split('');
    let burstCounter = 0;
    const burstLimit = naturalTyping ? Math.floor(randomBetween(6, 16)) : 999;
    const baseDelay = naturalTyping ? randomBetween(12, 55) : randomBetween(25, 80);
    const typeChar = async (char, delay) => {
        try {
            await page.keyboard.press(char, { delay });
        } catch (err) {
            await page.keyboard.insertText(char);
            if (delay) await page.waitForTimeout(delay);
        }
    };

    for (const char of chars) {
        if (naturalTyping && burstCounter >= burstLimit) {
            await page.waitForTimeout(randomBetween(60, 180));
            burstCounter = 0;
        }

        if (allowTypos && Math.random() < (naturalTyping ? 0.1 : 0.04)) {
            const keys = 'qwertyuiopasdfghjklzxcvbnm';
            const typo = keys[Math.floor(Math.random() * keys.length)];
            await page.keyboard.press(typo, { delay: 40 + Math.random() * 120 });
            if (Math.random() < 0.5) {
                await page.waitForTimeout(60 + Math.random() * 120);
            }
            await page.keyboard.press('Backspace', { delay: 40 + Math.random() * 120 });
            if (Math.random() < 0.3) {
                await page.keyboard.press(typo, { delay: 40 + Math.random() * 120 });
                await page.keyboard.press('Backspace', { delay: 40 + Math.random() * 120 });
            }
        }

        const extra = punctuationPause.test(char) ? randomBetween(60, 150) : randomBetween(0, 40);
        const fatiguePause = fatigue && Math.random() < 0.06 ? randomBetween(90, 200) : 0;
        await typeChar(char, baseDelay + extra + fatiguePause);
        burstCounter += 1;

        if (naturalTyping && char === ' ') {
            await page.waitForTimeout(randomBetween(20, 80));
        }
    }
}

async function handleAgent(req, res) {
    const data = (req.method === 'POST') ? req.body : req.query;
    let { url, actions, wait: globalWait, rotateUserAgents, rotateProxies, humanTyping, stealth = {} } = data;
    const runId = data.runId ? String(data.runId) : null;
    const captureRunId = runId || `run_${Date.now()}_unknown`;
    const includeShadowDomRaw = data.includeShadowDom ?? req.query.includeShadowDom;
    const includeShadowDom = includeShadowDomRaw === undefined
        ? true
        : !(String(includeShadowDomRaw).toLowerCase() === 'false' || includeShadowDomRaw === false);
    const disableRecordingRaw = data.disableRecording ?? req.query.disableRecording;
    const disableRecording = parseBooleanFlag(disableRecordingRaw);
    const statelessExecutionRaw = data.statelessExecution ?? req.query.statelessExecution;
    const statelessExecution = parseBooleanFlag(statelessExecutionRaw);
    const {
        allowTypos = false,
        idleMovements = false,
        overscroll = false,
        deadClicks = false,
        fatigue = false,
        naturalTyping = false
    } = stealth;

    if (typeof actions === 'string') {
        try {
            actions = JSON.parse(actions);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid actions JSON format.' });
        }
    }

    if (!actions || !Array.isArray(actions)) {
        return res.status(400).json({
            error: 'Actions array is required.',
            usage: 'POST JSON with {"actions": [...], "stealth": {...}}'
        });
    }

    const localPort = req.socket && req.socket.localPort;
    const configuredPort = process.env.PORT || process.env.VITE_BACKEND_PORT;
    const basePort = localPort || configuredPort || '11345';
    const baseUrl = `${req.protocol || 'http'}://127.0.0.1:${basePort}`;
    const runtimeVars = { ...(data.taskVariables || data.variables || {}) };
    let lastBlockOutput = null;
    runtimeVars['block.output'] = lastBlockOutput;

    const setBlockOutput = (value) => {
        lastBlockOutput = value;
        runtimeVars['block.output'] = value;
    };

    const resolveTemplate = (input) => {
        if (typeof input !== 'string') return input;
        return input.replace(/\{\$([\w.]+)\}/g, (_match, name) => {
            if (name === 'now') return new Date().toISOString();
            const value = runtimeVars[name];
            if (value === undefined || value === null) return '';
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
            }
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        });
    };

    const resolveMaybe = (value) => {
        if (typeof value !== 'string') return value;
        return resolveTemplate(value);
    };

    const parseCoords = (input) => {
        if (!input || typeof input !== 'string') return null;
        const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (!match) return null;
        const x = Number(match[1]);
        const y = Number(match[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    };

    const parseValue = (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return value;
            }
        }
        return value;
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

    const buildBlockMap = (list) => {
        const blockStarts = new Set(['if', 'while', 'repeat', 'foreach', 'on_error']);
        const startToEnd = {};
        const startToElse = {};
        const elseToEnd = {};
        const endToStart = {};
        const stack = [];

        list.forEach((action, idx) => {
            if (blockStarts.has(action.type)) {
                stack.push({ type: action.type, idx });
                return;
            }
            if (action.type === 'else') {
                for (let i = stack.length - 1; i >= 0; i -= 1) {
                    const entry = stack[i];
                    if (entry.type === 'if' && startToElse[entry.idx] === undefined) {
                        startToElse[entry.idx] = idx;
                        break;
                    }
                }
                return;
            }
            if (action.type === 'end') {
                const entry = stack.pop();
                if (!entry) return;
                startToEnd[entry.idx] = idx;
                endToStart[idx] = entry.idx;
                if (startToElse[entry.idx] !== undefined) {
                    elseToEnd[startToElse[entry.idx]] = idx;
                }
            }
        });

        return { startToEnd, startToElse, elseToEnd, endToStart };
    };

    const selectedUA = await selectUserAgent(rotateUserAgents);

    let browser;
    let context;
    let page;
    try {
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
        const useRotateProxies = String(rotateProxies).toLowerCase() === 'true' || rotateProxies === true;
        const selection = getProxySelection(useRotateProxies);
        if (selection.proxy) {
            launchOptions.proxy = selection.proxy;
        }
        console.log(`[PROXY] Mode: ${selection.mode}; Target: ${selection.proxy ? selection.proxy.server : 'host_ip'}`);
        browser = await chromium.launch(launchOptions);

        const recordingsDir = path.join(__dirname, 'data', 'recordings');
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }

        const rotateViewport = String(data.rotateViewport).toLowerCase() === 'true' || data.rotateViewport === true;
        const viewport = rotateViewport
            ? { width: 1280 + Math.floor(Math.random() * 640), height: 720 + Math.floor(Math.random() * 360) }
            : { width: 1366, height: 768 };

        const contextOptions = {
            userAgent: selectedUA,
            viewport,
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/New_York',
            colorScheme: 'dark',
            permissions: ['geolocation'],
        };

        const shouldUseStorageState = !statelessExecution && fs.existsSync(STORAGE_STATE_FILE);
        if (shouldUseStorageState) {
            contextOptions.storageState = STORAGE_STATE_FILE;
        }

        if (!disableRecording) {
            contextOptions.recordVideo = { dir: recordingsDir, size: viewport };
        }
        context = await browser.newContext(contextOptions);

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

        if (url) {
            await page.goto(resolveTemplate(url), { waitUntil: 'domcontentloaded', timeout: 60000 });
        }

        const logs = [];
        let actionIdx = 0;
        const baseDelay = (ms) => {
            const fatigueMultiplier = fatigue ? 1 + (actionIdx * 0.1) : 1;
            const microPause = fatigue && Math.random() < 0.08 ? randomBetween(120, 480) : 0;
            return ((ms + Math.random() * 140) * fatigueMultiplier) + microPause;
        };

        const { startToEnd, startToElse, elseToEnd, endToStart } = buildBlockMap(actions);
        const repeatState = new Map();
        const foreachState = new Map();
        let errorHandler = null;
        let inErrorHandler = false;
        let stopRequested = false;
        let stopOutcome = 'success';

        const normalizeVarRef = (raw) => {
            if (!raw) return '';
            const trimmed = String(raw).trim();
            const match = trimmed.match(/^\{\$([\w.]+)\}$/);
            return match ? match[1] : trimmed;
        };

        const getValueFromVarOrLiteral = (raw) => {
            const name = normalizeVarRef(raw);
            if (name && Object.prototype.hasOwnProperty.call(runtimeVars, name)) return runtimeVars[name];
            if (typeof raw === 'string') return resolveTemplate(raw);
            return raw;
        };

        const coerceBoolean = (value) => {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                const parsed = parseValue(value);
                if (typeof parsed === 'boolean') return parsed;
            }
            return Boolean(value);
        };

        const toNumber = (value) => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const parsed = parseValue(value);
                if (typeof parsed === 'number') return parsed;
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : NaN;
        };

        const toString = (value) => {
            if (value === undefined || value === null) return '';
            return String(value);
        };

        const evalStructuredCondition = (act) => {
            const varType = act.conditionVarType || 'string';
            const op = act.conditionOp || (varType === 'boolean' ? 'is_true' : 'equals');
            const leftRaw = getValueFromVarOrLiteral(act.conditionVar || '');
            const rightRaw = act.conditionValue ?? '';
            const rightResolved = resolveTemplate(String(rightRaw));

            if (varType === 'boolean') {
                const leftBool = coerceBoolean(leftRaw);
                return op === 'is_false' ? !leftBool : !!leftBool;
            }

            if (varType === 'number') {
                const leftNum = toNumber(leftRaw);
                const rightNum = toNumber(rightResolved);
                if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) return false;
                if (op === 'not_equals') return leftNum !== rightNum;
                if (op === 'gt') return leftNum > rightNum;
                if (op === 'gte') return leftNum >= rightNum;
                if (op === 'lt') return leftNum < rightNum;
                if (op === 'lte') return leftNum <= rightNum;
                return leftNum === rightNum;
            }

            const leftText = toString(leftRaw);
            const rightText = rightResolved;
            if (op === 'not_equals') return leftText !== rightText;
            if (op === 'contains') return leftText.includes(rightText);
            if (op === 'starts_with') return leftText.startsWith(rightText);
            if (op === 'ends_with') return leftText.endsWith(rightText);
            if (op === 'matches') {
                try {
                    const regex = new RegExp(rightText);
                    return regex.test(leftText);
                } catch {
                    return false;
                }
            }
            return leftText === rightText;
        };

        const evalCondition = async (expr) => {
            const resolved = resolveTemplate(expr || '');
            if (!resolved.trim()) return false;
            return page.evaluate(({ expression, vars, blockOutput }) => {
                const exists = (selector) => {
                    if (!selector) return false;
                    return !!document.querySelector(selector);
                };
                const text = (selector) => {
                    if (!selector) return '';
                    const el = document.querySelector(selector);
                    return el ? (el.textContent || '').trim() : '';
                };
                const url = () => window.location.href;
                const block = { output: blockOutput };
                // eslint-disable-next-line no-new-func
                const fn = new Function('vars', 'block', 'exists', 'text', 'url', `return !!(${expression});`);
                return fn(vars || {}, block, exists, text, url);
            }, { expression: resolved, vars: runtimeVars, blockOutput: lastBlockOutput });
        };

        const setLoopVars = (item, index, count) => {
            runtimeVars['loop.index'] = index;
            runtimeVars['loop.count'] = count;
            runtimeVars['loop.item'] = item;
            if (item && typeof item === 'object') {
                if ('text' in item) runtimeVars['loop.text'] = item.text;
                if ('html' in item) runtimeVars['loop.html'] = item.html;
            } else {
                runtimeVars['loop.text'] = item;
                runtimeVars['loop.html'] = '';
            }
        };

        const getForeachItems = async (act) => {
            const selector = resolveMaybe(act.selector);
            const varName = resolveMaybe(act.varName);
            if (selector) {
                return page.$$eval(String(selector), (elements) => elements.map((el) => ({
                    text: (el.textContent || '').trim(),
                    html: el.innerHTML || ''
                })));
            }
            if (varName && runtimeVars[String(varName)]) {
                const source = runtimeVars[String(varName)];
                if (Array.isArray(source)) return source;
                if (typeof source === 'string') {
                    try {
                        const parsed = JSON.parse(source);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                }
            }
            return [];
        };

        const getMergeSources = (raw) => {
            const resolved = resolveMaybe(raw);
            if (Array.isArray(resolved)) return resolved;
            if (resolved && typeof resolved === 'object') return [resolved];
            if (typeof resolved !== 'string') {
                return resolved === undefined || resolved === null ? [] : [resolved];
            }
            const tokens = resolved
                .split(',')
                .map((token) => token.trim())
                .filter(Boolean);
            if (tokens.length === 0) return [];
            const sources = [];
            tokens.forEach((token) => {
                const name = normalizeVarRef(token);
                if (Object.prototype.hasOwnProperty.call(runtimeVars, name)) {
                    sources.push(runtimeVars[name]);
                    return;
                }
                sources.push(parseValue(token));
            });
            return sources;
        };

        const mergeSources = (sources) => {
            const list = Array.isArray(sources) ? sources : [];
            if (list.length === 0) return [];
            const arraysOnly = list.every(Array.isArray);
            if (arraysOnly) return list.flat();
            const objectsOnly = list.every((item) => item && typeof item === 'object' && !Array.isArray(item));
            if (objectsOnly) return Object.assign({}, ...list);
            const merged = [];
            list.forEach((item) => {
                if (Array.isArray(item)) {
                    merged.push(...item);
                } else if (item !== undefined) {
                    merged.push(item);
                }
            });
            return merged;
        };

        const ensureCapturesDir = () => {
            const capturesDir = path.join(__dirname, 'public', 'captures');
            if (!fs.existsSync(capturesDir)) {
                fs.mkdirSync(capturesDir, { recursive: true });
            }
            return capturesDir;
        };

        const captureScreenshot = async (label) => {
            const capturesDir = ensureCapturesDir();
            const safeLabel = label ? String(label).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) : '';
            const nameSuffix = safeLabel ? `_${safeLabel}` : '';
            const screenshotName = `${captureRunId}_agent_${Date.now()}${nameSuffix}.png`;
            const screenshotPath = path.join(capturesDir, screenshotName);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            return `/captures/${screenshotName}`;
        };

        const executeAction = async (act) => {
            const { type, timeout } = act;
            const actionTimeout = timeout || 10000;
            let result = null;

            switch (type) {
                case 'navigate':
                case 'goto':
                    logs.push(`Navigating to: ${resolveMaybe(act.value)}`);
                    await page.goto(resolveMaybe(act.value), { waitUntil: 'domcontentloaded' });
                    result = page.url();
                    break;
                case 'click': {
                    const selectorValue = resolveMaybe(act.selector);
                    const coords = parseCoords(String(selectorValue || ''));
                    logs.push(`Clicking: ${selectorValue}`);
                    if (coords) {
                        await page.mouse.click(coords.x, coords.y, { delay: baseDelay(50) });
                        result = true;
                        break;
                    }
                    await page.waitForSelector(selectorValue, { timeout: actionTimeout });

                    // Neutral Dead Click
                    if (deadClicks && Math.random() < 0.4) {
                        logs.push('Performing neutral dead-click...');
                        const viewport = page.viewportSize() || { width: 1280, height: 720 };
                        await page.mouse.click(
                            10 + Math.random() * (viewport.width * 0.2),
                            10 + Math.random() * (viewport.height * 0.2)
                        );
                        await page.waitForTimeout(baseDelay(200));
                    }

                    // Get element point for human-like movement
                    const handle = await page.$(selectorValue);
                    const box = await handle.boundingBox();
                    if (box) {
                        const centerX = box.x + box.width / 2 + (Math.random() - 0.5) * 5;
                        const centerY = box.y + box.height / 2 + (Math.random() - 0.5) * 5;
                        await moveMouseHumanlike(page, centerX, centerY);
                        if (deadClicks && Math.random() < 0.25) {
                            const offsetX = (Math.random() - 0.5) * Math.min(20, box.width / 3);
                            const offsetY = (Math.random() - 0.5) * Math.min(20, box.height / 3);
                            await page.mouse.click(centerX + offsetX, centerY + offsetY, { delay: baseDelay(30) });
                            await page.waitForTimeout(baseDelay(120));
                        }
                    }

                    await page.waitForTimeout(baseDelay(50));
                    await page.click(selectorValue, {
                        delay: baseDelay(50)
                    });
                    result = true;
                    break;
                }
                    case 'type':
                    case 'fill': {
                        const selectorValue = act.selector ? resolveMaybe(act.selector) : null;
                        const valueText = resolveMaybe(act.value) || '';
                        const typeMode = act.typeMode === 'append' ? 'append' : 'replace';
                        const humanOptions = { allowTypos, naturalTyping, fatigue };

                        const typeIntoSelector = async () => {
                            if (!selectorValue) return;
                            if (typeMode === 'replace') {
                                if (humanTyping) {
                                    await page.fill(selectorValue, '');
                                    await humanType(page, selectorValue, valueText, humanOptions);
                                } else {
                                    await page.fill(selectorValue, valueText);
                                }
                                return;
                            }
                            if (humanTyping) {
                                await humanType(page, selectorValue, valueText, humanOptions);
                            } else {
                                await page.type(selectorValue, valueText, { delay: baseDelay(50) });
                            }
                        };

                        if (selectorValue) {
                            const coords = parseCoords(String(selectorValue));
                            logs.push(`Typing into ${selectorValue}: ${valueText}`);
                            if (coords) {
                                await page.mouse.click(coords.x, coords.y, { delay: baseDelay(50) });
                                await typeIntoSelector();
                                result = valueText;
                                break;
                            }
                            await page.waitForSelector(selectorValue, { timeout: actionTimeout });
                            await typeIntoSelector();
                        } else {
                            logs.push(`Typing (global): ${valueText}`);
                            if (humanTyping) {
                                await humanType(page, null, valueText, humanOptions);
                            } else {
                                await page.keyboard.type(valueText, { delay: baseDelay(50) });
                            }
                        }
                        result = valueText;
                        break;
                    }
                case 'hover': {
                    const selectorValue = resolveMaybe(act.selector);
                    const coords = parseCoords(String(selectorValue || ''));
                    logs.push(`Hovering: ${selectorValue}`);
                    if (coords) {
                        await moveMouseHumanlike(page, coords.x, coords.y);
                        result = true;
                        break;
                    }
                    await page.waitForSelector(selectorValue, { timeout: actionTimeout });
                    {
                        const handle = await page.$(selectorValue);
                        const box = handle && await handle.boundingBox();
                        if (box) {
                            const centerX = box.x + box.width / 2 + (Math.random() - 0.5) * 5;
                            const centerY = box.y + box.height / 2 + (Math.random() - 0.5) * 5;
                            await moveMouseHumanlike(page, centerX, centerY);
                        }
                    }
                    await page.waitForTimeout(baseDelay(150));
                    result = true;
                    break;
                }
                    case 'press':
                        logs.push(`Pressing key: ${resolveMaybe(act.key)}`);
                        await page.keyboard.press(resolveMaybe(act.key), { delay: baseDelay(50) });
                        result = resolveMaybe(act.key);
                        break;
                    case 'wait':
                        const ms = act.value ? parseFloat(resolveMaybe(act.value)) * 1000 : 2000;
                        logs.push(`Waiting: ${ms}ms`);

                        if (idleMovements) {
                            logs.push('Simulating cursor restlessness...');
                            await Promise.race([
                                idleMouse(page),
                                page.waitForTimeout(ms)
                            ]);
                        } else {
                            await page.waitForTimeout(ms);
                        }
                        result = ms;
                        break;
                    case 'select':
                        logs.push(`Selecting ${resolveMaybe(act.value)} from ${resolveMaybe(act.selector)}`);
                        await page.waitForSelector(resolveMaybe(act.selector), { timeout: actionTimeout });
                        await page.selectOption(resolveMaybe(act.selector), resolveMaybe(act.value));
                        result = resolveMaybe(act.value);
                        break;
                    case 'scroll': {
                        const amount = act.value ? parseInt(resolveMaybe(act.value), 10) : (400 + Math.random() * 400);
                        const speedMs = act.key ? parseInt(resolveMaybe(act.key), 10) : 500;
                        const durationMs = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 500;
                        logs.push(`Scrolling page: ${amount}px over ${durationMs}ms...`);
                        if (overscroll) {
                            await overshootScroll(page, amount);
                            await page.waitForTimeout(baseDelay(200));
                        } else if (act.selector) {
                            await page.evaluate(({ selector, y, duration }) => {
                                const el = document.querySelector(selector);
                                if (!el) return;
                                const start = el.scrollTop;
                                const target = start + y;
                                const startTime = performance.now();
                                const easeOut = (t) => 1 - Math.pow(1 - t, 3);
                                const step = (now) => {
                                    const elapsed = now - startTime;
                                    const t = Math.min(1, elapsed / duration);
                                    const next = start + (target - start) * easeOut(t);
                                    el.scrollTop = next;
                                    if (t < 1) requestAnimationFrame(step);
                                };
                                requestAnimationFrame(step);
                            }, { selector: resolveMaybe(act.selector), y: amount, duration: durationMs });
                            await page.waitForTimeout(baseDelay(durationMs));
                        } else {
                            await page.evaluate(({ y, duration }) => {
                                const start = window.scrollY || 0;
                                const target = start + y;
                                const startTime = performance.now();
                                const easeOut = (t) => 1 - Math.pow(1 - t, 3);
                                const step = (now) => {
                                    const elapsed = now - startTime;
                                    const t = Math.min(1, elapsed / duration);
                                    const next = start + (target - start) * easeOut(t);
                                    window.scrollTo(0, next);
                                    if (t < 1) requestAnimationFrame(step);
                                };
                                requestAnimationFrame(step);
                            }, { y: amount, duration: durationMs });
                            await page.waitForTimeout(baseDelay(durationMs));
                        }
                        result = amount;
                        break;
                    }
                    case 'screenshot':
                        logs.push('Capturing screenshot...');
                        try {
                            const shotUrl = await captureScreenshot(act.label || act.value || '');
                            result = shotUrl;
                            logs.push(`Screenshot saved: ${shotUrl}`);
                        } catch (e) {
                            logs.push(`Screenshot failed: ${e.message}`);
                        }
                        break;
                    case 'javascript':
                        logs.push('Running custom JavaScript...');
                        if (act.value) {
                            result = await page.evaluate((code) => {
                                // eslint-disable-next-line no-eval
                                return eval(code);
                            }, resolveMaybe(act.value));
                        }
                        break;
                    case 'csv': {
                        const source = act.value ? resolveTemplate(act.value) : lastBlockOutput;
                        if (typeof source === 'string') {
                            result = parseCsv(source);
                        } else if (Array.isArray(source) || (source && typeof source === 'object')) {
                            result = source;
                        } else {
                            result = [];
                        }
                        logs.push(`Parsed ${Array.isArray(result) ? result.length : 0} CSV rows.`);
                        break;
                    }
                    case 'merge': {
                        const sources = getMergeSources(act.value || '');
                        const merged = mergeSources(sources);
                        if (act.varName) {
                            const targetName = normalizeVarRef(act.varName);
                            runtimeVars[String(targetName)] = merged;
                        }
                        if (Array.isArray(merged)) {
                            logs.push(`Merged ${merged.length} item(s).`);
                        } else if (merged && typeof merged === 'object') {
                            logs.push(`Merged ${Object.keys(merged).length} field(s).`);
                        } else {
                            logs.push('Merged values.');
                        }
                        result = merged;
                        break;
                    }
                    case 'set':
                        if (act.varName) {
                            const resolved = resolveTemplate(act.value || '');
                            const parsed = parseValue(resolved);
                            runtimeVars[String(act.varName)] = parsed;
                            logs.push(`Set variable ${act.varName}`);
                            result = parsed;
                        }
                        break;
                    case 'stop':
                        stopRequested = true;
                        stopOutcome = act.value === 'error' ? 'error' : 'success';
                        logs.push(`Stop task (${stopOutcome}).`);
                        result = stopOutcome;
                        break;
                    case 'start': {
                        const taskId = resolveMaybe(act.value);
                        if (!taskId) throw new Error('Missing task id.');
                        const apiKey = loadApiKey() || data.apiKey || data.key;
                        if (!apiKey) {
                            logs.push('No API key available; attempting internal start.');
                        }
                        logs.push(`Starting task: ${taskId}`);
                        const headers = {
                            'Content-Type': 'application/json',
                            'x-internal-run': '1'
                        };
                        if (apiKey) {
                            headers['x-api-key'] = apiKey;
                        }
                        const response = await fetch(`${baseUrl}/tasks/${taskId}/api`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                variables: runtimeVars,
                                taskVariables: runtimeVars,
                                runSource: 'agent_block',
                                taskId
                            })
                        });
                        const payload = await response.json();
                        if (!response.ok) {
                            const detail = payload?.error || payload?.message || response.statusText;
                            throw new Error(`Start task failed: ${detail}`);
                        }
                        result = payload?.data ?? payload?.html ?? payload;
                        setBlockOutput(result);
                        break;
                    }
                }
            return result;
        };

        let index = 0;
        const maxSteps = Math.max(actions.length * 20, 1000);
        let steps = 0;

        while (index < actions.length) {
            if (isStopRequested(runId)) {
                logs.push('Execution stopped by user.');
                break;
            }
            if (steps++ > maxSteps) {
                logs.push('Execution aborted: possible infinite loop.');
                break;
            }

            const act = actions[index];
            actionIdx += 1;

            if (act.disabled) {
                logs.push(`SKIPPED disabled action: ${act.type}`);
                reportProgress(runId, { actionId: act.id, status: 'skipped' });
                index += 1;
                continue;
            }

            if (act.type === 'on_error') {
                const endIndex = startToEnd[index];
                if (endIndex !== undefined) {
                    reportProgress(runId, { actionId: act.id, status: 'running' });
                    errorHandler = { start: index + 1, end: endIndex };
                    logs.push('On-error handler registered.');
                    reportProgress(runId, { actionId: act.id, status: 'success' });
                    index = endIndex + 1;
                    continue;
                }
            }

            if (act.type === 'if') {
                try {
                    reportProgress(runId, { actionId: act.id, status: 'running' });
                    const hasStructured = act.conditionVarType || act.conditionOp || act.conditionVar || act.conditionValue;
                    const condition = hasStructured ? evalStructuredCondition(act) : await evalCondition(act.value);
                    setBlockOutput(condition);
                    logs.push(`If condition: ${condition ? 'true' : 'false'}`);
                    reportProgress(runId, { actionId: act.id, status: 'success' });
                    if (!condition) {
                        const elseIndex = startToElse[index];
                        if (elseIndex !== undefined) {
                            index = elseIndex + 1;
                        } else {
                            index = (startToEnd[index] ?? index) + 1;
                        }
                        continue;
                    }
                } catch (err) {
                    logs.push(`FAILED condition: ${err.message}`);
                    reportProgress(runId, { actionId: act.id, status: 'error' });
                    if (errorHandler && !inErrorHandler) {
                        inErrorHandler = true;
                        index = errorHandler.start;
                        continue;
                    }
                }
                index += 1;
                continue;
            }

            if (act.type === 'else') {
                reportProgress(runId, { actionId: act.id, status: 'success' });
                index = (elseToEnd[index] ?? index) + 1;
                continue;
            }

            if (act.type === 'while') {
                try {
                    reportProgress(runId, { actionId: act.id, status: 'running' });
                    const hasStructured = act.conditionVarType || act.conditionOp || act.conditionVar || act.conditionValue;
                    const condition = hasStructured ? evalStructuredCondition(act) : await evalCondition(act.value);
                    setBlockOutput(condition);
                    logs.push(`While condition: ${condition ? 'true' : 'false'}`);
                    reportProgress(runId, { actionId: act.id, status: 'success' });
                    if (!condition) {
                        index = (startToEnd[index] ?? index) + 1;
                        continue;
                    }
                } catch (err) {
                    logs.push(`FAILED condition: ${err.message}`);
                    reportProgress(runId, { actionId: act.id, status: 'error' });
                    if (errorHandler && !inErrorHandler) {
                        inErrorHandler = true;
                        index = errorHandler.start;
                        continue;
                    }
                }
                index += 1;
                continue;
            }

            if (act.type === 'repeat') {
                reportProgress(runId, { actionId: act.id, status: 'running' });
                const rawCount = parseInt(resolveMaybe(act.value) || '0', 10);
                const count = Number.isFinite(rawCount) ? rawCount : 0;
                let state = repeatState.get(index);
                if (!state) {
                    state = { remaining: count };
                    repeatState.set(index, state);
                }
                if (state.remaining <= 0) {
                    repeatState.delete(index);
                    reportProgress(runId, { actionId: act.id, status: 'success' });
                    index = (startToEnd[index] ?? index) + 1;
                    continue;
                }
                logs.push(`Repeat block: ${state.remaining} remaining`);
                setBlockOutput(state.remaining);
                reportProgress(runId, { actionId: act.id, status: 'success' });
                index += 1;
                continue;
            }

            if (act.type === 'foreach') {
                reportProgress(runId, { actionId: act.id, status: 'running' });
                let state = foreachState.get(index);
                if (!state) {
                    const items = await getForeachItems(act);
                    state = { items, index: 0 };
                    foreachState.set(index, state);
                }
                if (!state.items || state.items.length === 0) {
                    foreachState.delete(index);
                    reportProgress(runId, { actionId: act.id, status: 'success' });
                    index = (startToEnd[index] ?? index) + 1;
                    continue;
                }
                const item = state.items[state.index];
                setLoopVars(item, state.index, state.items.length);
                setBlockOutput(item);
                logs.push(`For-each item ${state.index + 1}/${state.items.length}`);
                reportProgress(runId, { actionId: act.id, status: 'success' });
                index += 1;
                continue;
            }

            if (act.type === 'end') {
                reportProgress(runId, { actionId: act.id, status: 'success' });
                const startIndex = endToStart[index];
                if (startIndex !== undefined) {
                    const startAction = actions[startIndex];
                    if (startAction.type === 'while') {
                        index = startIndex;
                        continue;
                    }
                    if (startAction.type === 'repeat') {
                        const state = repeatState.get(startIndex);
                        if (state) {
                            state.remaining -= 1;
                            if (state.remaining > 0) {
                                setBlockOutput(state.remaining);
                                index = startIndex + 1;
                                continue;
                            }
                            repeatState.delete(startIndex);
                        }
                    }
                    if (startAction.type === 'foreach') {
                        const state = foreachState.get(startIndex);
                        if (state) {
                            state.index += 1;
                            if (state.index < state.items.length) {
                                const item = state.items[state.index];
                                setLoopVars(item, state.index, state.items.length);
                                setBlockOutput(item);
                                index = startIndex + 1;
                                continue;
                            }
                            foreachState.delete(startIndex);
                        }
                    }
                }
                index += 1;
                if (inErrorHandler && errorHandler && index > errorHandler.end) {
                    break;
                }
                continue;
            }

            if (stopRequested) break;

            try {
                reportProgress(runId, { actionId: act.id, status: 'running' });
                const result = await executeAction(act);
                if (act.type === 'stop') {
                    setBlockOutput(result);
                    reportProgress(runId, { actionId: act.id, status: stopOutcome === 'error' ? 'error' : 'success' });
                    break;
                }
                if (result !== undefined) setBlockOutput(result);
                reportProgress(runId, { actionId: act.id, status: 'success' });
            } catch (err) {
                logs.push(`FAILED action ${act.type}: ${err.message}`);
                reportProgress(runId, { actionId: act.id, status: 'error' });
                if (errorHandler && !inErrorHandler) {
                    inErrorHandler = true;
                    index = errorHandler.start;
                    continue;
                }
            }

            if (stopRequested) break;

            index += 1;
            if (inErrorHandler && errorHandler && index > errorHandler.end) break;
        }

        if (globalWait) await page.waitForTimeout(parseFloat(globalWait) * 1000);
        await page.waitForTimeout(baseDelay(500));

        const cleanedHtml = await page.evaluate((withShadow) => {
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

            const clone = withShadow ? cloneWithShadow(document.documentElement) : document.documentElement.cloneNode(true);
            if (!withShadow) stripUseless(clone);
            return clone.outerHTML;
        }, includeShadowDom);

        const runExtractionScript = async (script, html, pageUrl) => {
            if (!script || typeof script !== 'string') return { result: undefined, logs: [] };
            try {
                const dom = new JSDOM(html || '');
                const { window } = dom;
                const logBuffer = [];
                const consoleProxy = {
                    log: (...args) => logBuffer.push(args.join(' ')),
                    warn: (...args) => logBuffer.push(args.join(' ')),
                    error: (...args) => logBuffer.push(args.join(' '))
                };
                const shadowHelpers = (() => {
                    const shadowQueryAll = (selector, root = window.document) => {
                        const results = [];
                        const walk = (node) => {
                            if (!node) return;
                            if (node.nodeType === 1) {
                                const el = node;
                                if (selector && el.matches && el.matches(selector)) results.push(el);
                                if (el.tagName === 'TEMPLATE' && el.hasAttribute('data-shadowroot')) {
                                    walk(el.content);
                                }
                            } else if (node.nodeType === 11) {
                                // DocumentFragment
                            }
                            if (node.childNodes) {
                                node.childNodes.forEach((child) => walk(child));
                            }
                        };
                        walk(root);
                        return results;
                    };

                    const shadowText = (root = window.document) => {
                        const texts = [];
                        const walk = (node) => {
                            if (!node) return;
                            if (node.nodeType === 3) {
                                const text = node.nodeValue ? node.nodeValue.trim() : '';
                                if (text) texts.push(text);
                                return;
                            }
                            if (node.nodeType === 1) {
                                const el = node;
                                if (el.tagName === 'TEMPLATE' && el.hasAttribute('data-shadowroot')) {
                                    walk(el.content);
                                }
                            }
                            if (node.childNodes) {
                                node.childNodes.forEach((child) => walk(child));
                            }
                        };
                        walk(root);
                        return texts;
                    };

                    return { shadowQueryAll, shadowText };
                })();

                // CodeQL alerts on dynamic eval, but extraction scripts intentionally run inside the browser sandbox,
                // so we expose only the helpers needed (window, document, DOMParser, console) and keep the evaluation confined there.
                const executor = new Function(
                    '$$data',
                    'window',
                    'document',
                    'DOMParser',
                    'console',
                    `"use strict"; return (async () => { ${script}\n})();`
                );
                const $$data = {
                    html: () => html || '',
                    url: () => pageUrl || '',
                    window,
                    document: window.document,
                    shadowQueryAll: includeShadowDom ? shadowHelpers.shadowQueryAll : undefined,
                    shadowText: includeShadowDom ? shadowHelpers.shadowText : undefined
                };
                const result = await executor($$data, window, window.document, window.DOMParser, consoleProxy);
                return { result, logs: logBuffer };
            } catch (e) {
                return { result: `Extraction script error: ${e.message}`, logs: [] };
            }
        };

        const extractionScriptRaw = typeof data.extractionScript === 'string'
            ? data.extractionScript
            : (data.taskSnapshot && typeof data.taskSnapshot.extractionScript === 'string' ? data.taskSnapshot.extractionScript : undefined);
        const extractionScript = extractionScriptRaw ? resolveTemplate(extractionScriptRaw) : undefined;
        const extraction = await runExtractionScript(extractionScript, cleanedHtml, page.url());

        // Simple HTML Formatter (fallback to raw if formatting collapses content)
        const formatHTML = (html) => {
            let indent = 0;
            return html.replace(/<(\/?)([a-z0-9]+)([^>]*?)(\/?)>/gi, (match, slash, tag, attrs, selfClose) => {
                if (slash) indent--;
                const result = '  '.repeat(Math.max(0, indent)) + match;
                if (!slash && !selfClose && !['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tag.toLowerCase())) indent++;
                return '\n' + result;
            }).trim();
        };

        const safeFormatHTML = (html) => {
            if (typeof html !== 'string') return '';
            try {
                const formatted = formatHTML(html);
                if (!formatted) return html;
                if (formatted.length < Math.max(200, Math.floor(html.length * 0.5))) return html;
                return formatted;
            } catch {
                return html;
            }
        };

        // Ensure the public/screenshots directory exists
        const capturesDir = path.join(__dirname, 'public', 'captures');
        if (!fs.existsSync(capturesDir)) {
            fs.mkdirSync(capturesDir, { recursive: true });
        }

        const screenshotName = `${captureRunId}_agent_${Date.now()}.png`;
        const screenshotPath = path.join(capturesDir, screenshotName);
        try {
            await page.screenshot({ path: screenshotPath, fullPage: false });
        } catch (e) {
            console.error('Agent Screenshot failed:', e.message);
        }

        const extractionFormat = String(data.extractionFormat || (data.taskSnapshot && data.taskSnapshot.extractionFormat) || '').toLowerCase() === 'csv'
            ? 'csv'
            : 'json';
        const rawExtraction = extraction.result !== undefined ? extraction.result : (extraction.logs.length ? extraction.logs.join('\n') : undefined);
        const formattedExtraction = extractionFormat === 'csv' ? toCsvString(rawExtraction) : rawExtraction;

        // Defensive return for the frontend: always return fields, even if empty on error
        const outputData = {
            final_url: page.url() || url || '',
            logs: logs || [],
            html: typeof cleanedHtml === 'string' ? safeFormatHTML(cleanedHtml) : '',
            data: formattedExtraction,
            screenshot_url: fs.existsSync(screenshotPath) ? `/captures/${screenshotName}` : null
        };

        const video = page.video();
        if (!statelessExecution) {
            try { await context.storageState({ path: STORAGE_STATE_FILE }); } catch {}
        }
        try { await context.close(); } catch {}
        if (video) {
            try {
                const videoPath = await video.path();
                if (videoPath && fs.existsSync(videoPath)) {
                    const recordingName = `${captureRunId}_agent_${Date.now()}.webm`;
                    const recordingPath = path.join(capturesDir, recordingName);
                    try {
                        fs.renameSync(videoPath, recordingPath);
                    } catch (err) {
                        if (err && err.code === 'EXDEV') {
                            fs.copyFileSync(videoPath, recordingPath);
                            fs.unlinkSync(videoPath);
                        } else {
                            throw err;
                        }
                    }
                }
            } catch (e) {
                console.error('Recording save failed:', e.message);
            }
        }
        try { await browser.close(); } catch {}
        res.json(outputData);
    } catch (error) {
        console.error('Agent Error:', error);
        try {
            if (context) await context.close();
        } catch {}
        if (browser) await browser.close();
        res.status(500).json({ error: 'Agent failed', details: error.message });
    }
}

module.exports = { handleAgent, setProgressReporter, setStopChecker };
