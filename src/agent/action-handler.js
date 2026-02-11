const { validateUrl } = require('../../url-utils');
const { parseCoords, parseValue, parseCsv } = require('../../common-utils');
const { moveMouseHumanlike, idleMouse, overshootScroll, humanType } = require('./human-interaction');
const { loadApiKey } = require('../server/storage'); // Need to access server storage for internal API key loading

const normalizeVarRef = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const match = trimmed.match(/^\{\$([\w.]+)\}$/);
    return match ? match[1] : trimmed;
};

const getMergeSources = (raw, runtimeVars, resolveTemplate) => {
    const resolveMaybe = (val) => typeof val === 'string' ? resolveTemplate(val) : val;
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

const executeAction = async (act, context) => {
    const {
        page,
        logs,
        runtimeVars,
        resolveTemplate,
        captureScreenshot,
        baseDelay,
        options,
        baseUrl,
        lastBlockOutput,
        setStopOutcome,
        setStopRequested
    } = context;

    const {
        deadClicks,
        humanTyping,
        allowTypos,
        naturalTyping,
        fatigue,
        idleMovements,
        overscroll
    } = options;

    const humanOptions = { allowTypos, naturalTyping, fatigue };
    const resolveMaybe = (val) => typeof val === 'string' ? resolveTemplate(val) : val;
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
            const source = act.value ? resolveMaybe(act.value) : lastBlockOutput;
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
            const sources = getMergeSources(act.value || '', runtimeVars, resolveTemplate);
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
                const resolved = resolveMaybe(act.value || '');
                const parsed = parseValue(resolved);
                runtimeVars[String(act.varName)] = parsed;
                logs.push(`Set variable ${act.varName}`);
                result = parsed;
            }
            break;
        case 'stop':
            setStopRequested(true);
            setStopOutcome(act.value === 'error' ? 'error' : 'success');
            logs.push(`Stop task (${act.value === 'error' ? 'error' : 'success'}).`);
            result = act.value === 'error' ? 'error' : 'success';
            break;
        case 'start': {
            const taskId = resolveMaybe(act.value);
            if (!taskId) throw new Error('Missing task id.');
            const apiKey = (await loadApiKey()) || context.options.apiKey; // Handle API key from context option if needed, but mainly loadApiKey
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
            break;
        }
    }
    return result;
};

module.exports = {
    executeAction
};
