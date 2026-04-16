function cleanHtml(withShadow) {
    // ⚡ Bolt: Define keepAttrs once to avoid redundant Set creation during recursion.
    // Redundant 'data-*' entries removed as they are handled by a prefix check.
    const keepAttrs = new Set(['id', 'class', 'href', 'src', 'alt', 'title', 'name', 'value', 'type', 'placeholder', 'aria-label', 'selected', 'checked', 'disabled', 'multiple', 'for', 'action', 'method', 'content', 'datetime', 'colspan', 'rowspan', 'scope']);

    const stripUseless = (root) => {
        // Remove elements that can never be meaningful for extraction
        const useless = root.querySelectorAll(
            'script, style, link, meta, noscript, svg, canvas, ' +
            'iframe, object, embed, applet, param, source, track, ' +
            'head > *:not(title)'
        );
        // ⚡ Bolt: Use for-loop instead of forEach for improved performance.
        for (let i = 0, len = useless.length; i < len; i++) {
            useless[i].remove();
        }

        // Strip all attributes except those useful for extraction
        const allEls = root.querySelectorAll('*');
        for (let i = 0, len = allEls.length; i < len; i++) {
            const el = allEls[i];

            // ⚡ Bolt: Fast-path skip for elements without attributes (often 30-50% of DOM).
            if (!el.hasAttributes || !el.hasAttributes()) continue;

            // ⚡ Bolt: Use getAttributeNames() to avoid creating Attr objects for every attribute.
            // This is significantly faster in most engines including V8/Chromium.
            if (el.getAttributeNames) {
                const names = el.getAttributeNames();
                for (let j = 0, nameLen = names.length; j < nameLen; j++) {
                    const name = names[j];
                    if (!keepAttrs.has(name) && !name.startsWith('data-')) {
                        el.removeAttribute(name);
                    }
                }
            } else {
                // Fallback for environments where getAttributeNames is missing
                const attrs = el.attributes;
                if (!attrs) continue;
                const toRemove = [];
                for (let j = 0, attrLen = attrs.length; j < attrLen; j++) {
                    const attr = attrs[j];
                    if (attr && !keepAttrs.has(attr.name) && !attr.name.startsWith('data-')) {
                        toRemove.push(attr.name);
                    }
                }
                for (let j = 0, removeLen = toRemove.length; j < removeLen; j++) {
                    el.removeAttribute(toRemove[j]);
                }
            }
        }
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
}

function installMouseHelper() {
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
        'border:2px solid rgba(96,165,250,0.7)',
        'background:rgba(59,130,246,0.25)',
        'border-radius:50%',
        'box-shadow:0 0 10px rgba(96,165,250,0.6)',
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
        'background:rgba(59,130,246,0.9)',
        'border-radius:50%',
        'box-shadow:0 0 12px rgba(59,130,246,0.8)',
        'pointer-events:none',
        'z-index:2147483647',
        'opacity:0',
        'transform:translate3d(0,0,0) scale(0.6)',
        'transition:opacity 120ms ease, transform 120ms ease'
    ].join(';');

    // Ensure documentElement exists before appending, otherwise wait for it
    if (document.documentElement) {
        document.documentElement.appendChild(cursor);
        document.documentElement.appendChild(dot);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            document.documentElement.appendChild(cursor);
            document.documentElement.appendChild(dot);
        });
    }

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
}

module.exports = { cleanHtml, installMouseHelper };
