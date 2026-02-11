const randomBetween = (min, max) => min + Math.random() * (max - min);

async function moveMouseHumanlike(page, targetX, targetY) {
    const steps = 8 + Math.floor(Math.random() * 6);
    const startX = targetX + (Math.random() - 0.5) * 120;
    const startY = targetY + (Math.random() - 0.5) * 120;
    const ctrlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 80;
    const ctrlY = (startY + targetY) / 2 + (Math.random() - 0.5) * 80;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const inv = 1 - t;
        const curveX = inv * inv * startX + 2 * inv * t * ctrlX + t * t * targetX;
        const curveY = inv * inv * startY + 2 * inv * t * ctrlY + t * t * targetY;
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        await page.mouse.move(curveX + jitterX, curveY + jitterY, { steps: 1 });
    }
}

async function idleMouse(page) {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const drifts = 3 + Math.floor(Math.random() * 3);
    let x = Math.random() * viewport.width;
    let y = Math.random() * viewport.height;
    for (let i = 0; i < drifts; i++) {
        const targetX = Math.random() * viewport.width;
        const targetY = Math.random() * viewport.height;
        const steps = 20 + Math.floor(Math.random() * 20);
        for (let s = 0; s < steps; s++) {
            x += (targetX - x) / (steps - s);
            y += (targetY - y) / (steps - s);
            await page.mouse.move(x, y, { steps: 1 });
        }
        if (Math.random() < 0.4) {
            await page.waitForTimeout(200 + Math.random() * 600);
        }
    }
}

async function overshootScroll(page, targetY) {
    const overshoot = (Math.random() > 0.5 ? 1 : -1) * (40 + Math.floor(Math.random() * 120));
    const smoothTarget = targetY + overshoot;

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), smoothTarget);
    await page.waitForTimeout(250 + Math.random() * 400);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), targetY);
    if (Math.random() < 0.35) {
        await page.waitForTimeout(120 + Math.random() * 200);
        await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), (Math.random() - 0.5) * 60);
    }
}

const punctuationPause = /[.,!?;:]/;

async function humanType(page, selector, text, options = {}) {
    const { allowTypos = false, naturalTyping = false, fatigue = false } = options;
    if (selector) await page.focus(selector);
    const chars = text.split('');
    let burstCounter = 0;
    const burstLimit = naturalTyping ? Math.floor(randomBetween(6, 16)) : 999;
    const baseDelay = naturalTyping ? randomBetween(12, 55) : randomBetween(25, 80);
    const typeChar = async (char, delay) => {
        try {
            await page.keyboard.press(char, { delay });
        } catch (err) {
            await page.keyboard.insertText(char);
            if (delay) await page.waitForTimeout(delay);
        }
    };

    for (const char of chars) {
        if (naturalTyping && burstCounter >= burstLimit) {
            await page.waitForTimeout(randomBetween(60, 180));
            burstCounter = 0;
        }

        if (allowTypos && Math.random() < (naturalTyping ? 0.1 : 0.04)) {
            const keys = 'qwertyuiopasdfghjklzxcvbnm';
            const typo = keys[Math.floor(Math.random() * keys.length)];
            await page.keyboard.press(typo, { delay: 40 + Math.random() * 120 });
            if (Math.random() < 0.5) {
                await page.waitForTimeout(60 + Math.random() * 120);
            }
            await page.keyboard.press('Backspace', { delay: 40 + Math.random() * 120 });
            if (Math.random() < 0.3) {
                await page.keyboard.press(typo, { delay: 40 + Math.random() * 120 });
                await page.keyboard.press('Backspace', { delay: 40 + Math.random() * 120 });
            }
        }

        const extra = punctuationPause.test(char) ? randomBetween(60, 150) : randomBetween(0, 40);
        const fatiguePause = fatigue && Math.random() < 0.06 ? randomBetween(90, 200) : 0;
        await typeChar(char, baseDelay + extra + fatiguePause);
        burstCounter += 1;

        if (naturalTyping && char === ' ') {
            await page.waitForTimeout(randomBetween(20, 80));
        }
    }
}

module.exports = {
    moveMouseHumanlike,
    idleMouse,
    overshootScroll,
    humanType
};
