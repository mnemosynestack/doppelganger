async function injectCursor(context) {
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
}

module.exports = { injectCursor };
