const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(name) {
    if (name === 'jsdom') {
        return { JSDOM: function() { return { window: { document: {}, DOMParser: function(){} } }; } };
    }
    return originalRequire.apply(this, arguments);
};

const { createSafeProxy } = require('../src/agent/sandbox');
const assert = require('assert');

function testEscape() {
    console.log('Testing Sandbox Escape via getPrototypeOf in src/agent/sandbox.js...');
    const obj = { a: 1 };
    const proxy = createSafeProxy(obj);

    const proto = Object.getPrototypeOf(proxy);

    if (proto === Object.prototype) {
        console.log('VULNERABILITY: Real Object.prototype leaked!');
        return true;
    }

    if (proto && proto.constructor !== undefined) {
        console.log('VULNERABILITY: Prototype constructor is accessible!');
        return true;
    }

    console.log('SUCCESS: Prototype is properly sandboxed.');
    return false;
}

if (testEscape()) {
    process.exit(1);
} else {
    process.exit(0);
}
