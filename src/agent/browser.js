const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getProxySelection } = require('../../proxy-rotation');

async function launchBrowser(options = {}) {
    const { rotateProxies } = options;
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
    return await chromium.launch(launchOptions);
}

async function createBrowserContext(browser, options = {}) {
    const {
        userAgent,
        rotateViewport,
        statelessExecution,
        storageStateFile,
        disableRecording,
        recordingsDir,
        includeShadowDom
    } = options;

    const viewport = rotateViewport
        ? { width: 1280 + Math.floor(Math.random() * 640), height: 720 + Math.floor(Math.random() * 360) }
        : { width: 1366, height: 768 };

    const contextOptions = {
        userAgent: userAgent,
        viewport,
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        colorScheme: 'dark',
        permissions: ['geolocation'],
    };

    if (!statelessExecution && storageStateFile && fs.existsSync(storageStateFile)) {
        try {
            const stat = fs.statSync(storageStateFile);
             if (!stat.isDirectory()) {
                contextOptions.storageState = storageStateFile;
             }
        } catch {}
    }

    if (!disableRecording && recordingsDir) {
        contextOptions.recordVideo = { dir: recordingsDir, size: viewport };
    }

    const context = await browser.newContext(contextOptions);

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

    return context;
}

module.exports = { launchBrowser, createBrowserContext };
