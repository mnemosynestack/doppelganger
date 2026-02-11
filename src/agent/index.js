const fs = require('fs');
const path = require('path');
const { selectUserAgent } = require('../../user-agent-settings');
const { formatHTML, safeFormatHTML } = require('../../html-utils');
const { validateUrl } = require('../../url-utils');
const { parseBooleanFlag, parseValue, parseCsv, csvEscape, toCsvString } = require('../../common-utils');
const { moveMouseHumanlike, idleMouse, overshootScroll, humanType } = require('./human-interaction');
const { runExtractionScript } = require('./sandbox');
const { cleanHtml } = require('./dom-utils');
const { launchBrowser, createBrowserContext } = require('./browser');

const STORAGE_STATE_PATH = path.join(__dirname, '../../storage_state.json');
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

const buildBlockMap = (list) => {
    const map = {
        startToEnd: new Map(),
        startToElse: new Map(),
        elseToEnd: new Map(),
        endToStart: new Map()
    };
    const stack = [];
    list.forEach((act, idx) => {
        if (act.type === 'condition_start' || act.type === 'loop_start') {
            stack.push({ idx, type: act.type });
        } else if (act.type === 'condition_else') {
            if (stack.length > 0) {
                const start = stack[stack.length - 1];
                if (start.type === 'condition_start') {
                    map.startToElse.set(start.idx, idx);
                    stack.push({ idx, type: 'condition_else' });
                }
            }
        } else if (act.type === 'condition_end') {
            let elseIdx = -1;
            if (stack.length > 0 && stack[stack.length - 1].type === 'condition_else') {
                elseIdx = stack.pop().idx;
            }
            if (stack.length > 0) {
                const start = stack.pop();
                if (start.type === 'condition_start') {
                    map.startToEnd.set(start.idx, idx);
                    if (elseIdx !== -1) {
                        map.elseToEnd.set(elseIdx, idx);
                    }
                }
            }
        } else if (act.type === 'loop_end') {
            if (stack.length > 0) {
                const start = stack.pop();
                if (start.type === 'loop_start') {
                    map.startToEnd.set(start.idx, idx);
                    map.endToStart.set(idx, start.idx);
                }
            }
        }
    });
    return map;
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

async function handleAgent(req, res) {
    const data = (req.method === 'POST') ? req.body : req.query;
    let { url, actions, wait: globalWait, rotateUserAgents, rotateProxies, humanTyping, stealth = {} } = data;

    if (url) {
        try {
            await validateUrl(url);
        } catch (e) {
            return res.status(400).json({ error: 'INVALID_URL', details: e.message });
        }
    }

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
        const useRotateProxies = String(rotateProxies).toLowerCase() === 'true' || rotateProxies === true;
        browser = await launchBrowser({ rotateProxies: useRotateProxies });

        const recordingsDir = path.join(__dirname, '../../data/recordings');
        await fs.promises.mkdir(recordingsDir, { recursive: true });

        const selectedUA = await selectUserAgent(rotateUserAgents);
        const rotateViewport = String(data.rotateViewport).toLowerCase() === 'true' || data.rotateViewport === true;

        context = await createBrowserContext(browser, {
            userAgent: selectedUA,
            rotateViewport,
            statelessExecution,
            storageStateFile: STORAGE_STATE_FILE,
            disableRecording,
            recordingsDir,
            includeShadowDom
        });

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
            const capturesDir = path.join(__dirname, '../../public', 'captures');
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
                case 'goto': {
                    const targetUrl = resolveMaybe(act.value);
                    try {
                        await validateUrl(targetUrl);
                    } catch (e) {
                        throw new Error(`Access to private network is restricted`);
                    }
                    logs.push(`Navigating to: ${targetUrl}`);
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
                    result = page.url();
                    break;
                }
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
                        const apiKey = (await loadApiKey()) || data.apiKey || data.key;
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

        const cleanedHtml = await page.evaluate(cleanHtml, includeShadowDom);

        // runExtractionScript definition removed (imported)

        const extractionScriptRaw = typeof data.extractionScript === 'string'
            ? data.extractionScript
            : (data.taskSnapshot && typeof data.taskSnapshot.extractionScript === 'string' ? data.taskSnapshot.extractionScript : undefined);
        const extractionScript = extractionScriptRaw ? resolveTemplate(extractionScriptRaw) : undefined;
        const extraction = await runExtractionScript(extractionScript, cleanedHtml, page.url(), includeShadowDom);

        // Ensure the public/screenshots directory exists
        const capturesDir = path.join(__dirname, '../../public', 'captures');
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
