
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    // 1. Start the mock server (assuming it's running separately or started here)
    // For simplicity, let's assume the user starts the mock server or we run against the real dev server.
    // However, since we need to verify frontend changes, we should run against the dev server.
    // If the dev server is not running, we can't verify.

    // Check if the dev server is reachable
    const baseUrl = 'http://localhost:5173'; // Vite dev server

    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();

        // 2. Navigate to the Captures page
        console.log(`Navigating to ${baseUrl}/captures...`);
        await page.goto(`${baseUrl}/captures`);

        // 3. Wait for the capture cards to load
        // We look for the "Open" link which indicates a card is rendered
        await page.waitForSelector('text=Open', { timeout: 10000 });

        // 4. Verify the new elements
        // Check for the Copy button (it has aria-label="Copy URL" or title="Copy URL")
        const copyButton = await page.$('button[title="Copy URL"]');
        if (copyButton) {
            console.log('✅ Copy URL button found.');
        } else {
            console.error('❌ Copy URL button NOT found.');
        }

        // Check for file size text (e.g., "KB" or "MB")
        const fileSizeElement = await page.$('text=/\\d+(\\.\\d+)?\\s(KB|MB|B)/');
        if (fileSizeElement) {
             console.log('✅ File size text found.');
        } else {
             // It might be hard to select by regex text directly in some versions,
             // let's try to find the container
             const cardContent = await page.content();
             if (cardContent.includes('KB') || cardContent.includes('MB') || cardContent.includes(' B')) {
                 console.log('✅ File size text found in content.');
             } else {
                 console.error('❌ File size text NOT found.');
             }
        }

        // 5. Take a screenshot
        const screenshotPath = path.resolve(__dirname, 'verification.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved to ${screenshotPath}`);

        await browser.close();

    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
})();
