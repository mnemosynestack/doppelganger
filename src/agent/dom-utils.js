function cleanHtml(withShadow) {
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
}

module.exports = { cleanHtml };
