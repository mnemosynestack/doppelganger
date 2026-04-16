const { JSDOM } = require('jsdom');
const { cleanHtml } = require('../src/agent/dom-utils');

function createLargeDOM(numElements) {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
    const { window } = dom;
    const { document } = window;
    const app = document.getElementById('app');

    for (let i = 0; i < numElements; i++) {
        const div = document.createElement('div');
        div.setAttribute('id', `item-${i}`);
        div.setAttribute('class', 'item-class');
        div.setAttribute('data-index', i);
        div.setAttribute('onclick', 'alert(1)'); // should be removed
        div.setAttribute('style', 'color: red'); // should be removed

        const span = document.createElement('span');
        span.textContent = `Text ${i}`;
        div.appendChild(span);

        const script = document.createElement('script');
        script.textContent = 'console.log("bad")'; // should be removed
        div.appendChild(script);

        app.appendChild(div);
    }
    return dom;
}

async function runBenchmark() {
    console.log('Generating large DOM...');
    const numElements = 2000;
    const dom = createLargeDOM(numElements);
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;
    global.Element = dom.window.Element;
    global.document.documentElement = dom.window.document.documentElement;

    console.log(`Running cleanHtml on ${numElements} elements...`);

    // Warm up
    cleanHtml(false);

    const start = Date.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
        cleanHtml(false);
    }
    const end = Date.now();

    console.log(`Average execution time: ${(end - start) / iterations}ms`);

    // Simple verification
    const result = cleanHtml(false);
    if (result.includes('onclick') || result.includes('style=') || result.includes('<script')) {
        console.error('FAIL: Optimization broke cleaning logic');
    } else {
        console.log('SUCCESS: Cleaning logic verified');
    }
}

runBenchmark().catch(console.error);
