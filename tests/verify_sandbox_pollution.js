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

function testPollution() {
    console.log('Testing Sandbox Prototype Pollution via createSafeProxy...');

    const obj = { data: 'original' };
    const proxy = createSafeProxy(obj);

    // Attempt to pollute the prototype through the proxy
    try {
        const proto = Object.getPrototypeOf(proxy);
        if (proto) {
            proto.polluted = 'yes';
        }
    } catch (e) {
        console.log('Prototype access failed as expected or threw error:', e.message);
    }

    if (({}).polluted === 'yes') {
        console.log('VULNERABILITY: Host prototype polluted via getPrototypeOf!');
        return true;
    }

    // Attempt to use __proto__ if not blocked
    try {
        proxy.__proto__.polluted2 = 'yes';
    } catch (e) {
        // Expected if __proto__ is blocked
    }

    if (({}).polluted2 === 'yes') {
        console.log('VULNERABILITY: Host prototype polluted via __proto__!');
        return true;
    }

    // Attempt to set a property that doesn't exist to see if it's allowed
    try {
        proxy.newProp = 'attack';
        if (obj.newProp === 'attack') {
            console.log('VULNERABILITY: Underlying object was modified!');
            return true;
        }
    } catch (e) {
        // Expected if set is blocked
    }

    console.log('SUCCESS: No immediate pollution detected or traps already partially present.');
    return false;
}

if (testPollution()) {
    process.exit(1);
} else {
    process.exit(0);
}
