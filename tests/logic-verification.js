
const assert = require('assert');

// Mock Node and Element for testing the logic without JSDOM
class MockNode {
    constructor(type, name = '', value = '') {
        this.nodeType = type;
        this.nodeName = name;
        this.tagName = name.toUpperCase();
        this.nodeValue = value;
        this.childNodes = [];
        this.firstChild = null;
        this.lastChild = null;
        this.nextSibling = null;
        this.attributes = new Map();
    }

    appendChild(child) {
        if (this.lastChild) {
            this.lastChild.nextSibling = child;
        } else {
            this.firstChild = child;
        }
        this.childNodes.push(child);
        this.lastChild = child;
        return child;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }
}

class MockElement extends MockNode {
    constructor(name) {
        super(1, name);
        this.content = new MockNode(11, '#document-fragment'); // For templates
    }

    querySelectorAll(selector) {
        // Very simple mock querySelectorAll that just searches childNodes (non-recursive for simplicity of the test helper)
        const results = [];
        const search = (node) => {
            if (node.tagName === selector.toUpperCase() || (selector === 'template[data-shadowroot]' && node.tagName === 'TEMPLATE' && node.hasAttribute('data-shadowroot'))) {
                results.push(node);
            }
            node.childNodes.forEach(search);
        };
        // In reality querySelectorAll on the root finds all descendants.
        // We will mock it to return specific nodes for our test cases.
        return this._mockMatches || [];
    }
}

// The functions to test (copied from sandbox.js)
const shadowQueryAll = (selector, root) => {
    const results = [];
    if (!root) return results;

    if (root.querySelectorAll) {
        const matches = root.querySelectorAll(selector);
        for (let i = 0; i < matches.length; i++) results.push(matches[i]);

        const templates = root.querySelectorAll('template[data-shadowroot]');
        for (let i = 0; i < templates.length; i++) {
            const shadowMatches = shadowQueryAll(selector, templates[i].content);
            for (let j = 0; j < shadowMatches.length; j++) results.push(shadowMatches[j]);
        }
    }

    return results;
};

const shadowText = (root) => {
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
        let child = node.firstChild;
        while (child) {
            walk(child);
            child = child.nextSibling;
        }
    };
    walk(root);
    return texts;
};

// Test shadowQueryAll
console.log('Testing shadowQueryAll logic...');
const root = new MockElement('div');
const div1 = new MockElement('div');
const template = new MockElement('template');
template.setAttribute('data-shadowroot', 'open');
const div2 = new MockElement('div');
template.content.appendChild(div2);

root._mockMatches = [div1]; // Mocking that querySelectorAll('div') finds div1
root.appendChild(div1);
root.appendChild(template);

// Mocking that querySelectorAll('template[data-shadowroot]') finds the template
root.querySelectorAll = (sel) => {
    if (sel === 'div') return [div1];
    if (sel === 'template[data-shadowroot]') return [template];
    return [];
};
template.content.querySelectorAll = (sel) => {
    if (sel === 'div') return [div2];
    if (sel === 'template[data-shadowroot]') return [];
    return [];
};

const matches = shadowQueryAll('div', root);
console.log('Matches count:', matches.length);
assert.strictEqual(matches.length, 2, 'Should find 2 divs (one in light DOM, one in shadow DOM)');
assert.strictEqual(matches[0], div1);
assert.strictEqual(matches[1], div2);
console.log('✓ shadowQueryAll logic verified');

// Test shadowText
console.log('\nTesting shadowText logic...');
const textRoot = new MockNode(1, 'div');
const t1 = new MockNode(3, '', 'Hello');
const tTemp = new MockElement('template');
tTemp.setAttribute('data-shadowroot', 'open');
const t2 = new MockNode(3, '', 'World');
tTemp.content.appendChild(t2);
const t3 = new MockNode(3, '', '!');

textRoot.appendChild(t1);
textRoot.appendChild(tTemp);
textRoot.appendChild(t3);

const texts = shadowText(textRoot);
console.log('Texts:', texts);
assert.deepStrictEqual(texts, ['Hello', 'World', '!'], 'Should extract all text including from shadow DOM');
console.log('✓ shadowText logic verified');

console.log('\nSUCCESS: Logic verification complete.');
