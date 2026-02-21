import { copyToClipboard } from "../src/utils/clipboard";
import assert from "assert";
import { JSDOM } from "jsdom";

// Setup JSDOM
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});
global.window = dom.window as any;
global.document = dom.window.document;

let execCommandCalled = false;

// Mock document.execCommand
// JSDOM document doesn't implement execCommand by default or returns false.
// We override it.
(global.document as any).execCommand = (commandId: string) => {
  if (commandId === "copy") {
    execCommandCalled = true;
    return true;
  }
  return false;
};

// Mock navigator.clipboard
let clipboardText = "";
const mockClipboard = {
  writeText: async (text: string) => {
    clipboardText = text;
    return Promise.resolve();
  },
};

// Patch global.navigator.clipboard
if (global.navigator) {
  Object.defineProperty(global.navigator, "clipboard", {
    value: mockClipboard,
    writable: true,
    configurable: true,
  });
} else {
  (global as any).navigator = dom.window.navigator;
  Object.defineProperty(global.navigator, "clipboard", {
    value: mockClipboard,
    writable: true,
    configurable: true,
  });
}

// Mock isSecureContext
Object.defineProperty(global.window, "isSecureContext", {
  value: true,
  writable: true,
  configurable: true,
});

console.log("Testing copyToClipboard utility...");

async function runTests() {
  // Test 1: Secure context (navigator.clipboard)
  console.log("Test 1: Secure context (navigator.clipboard)");
  clipboardText = "";
  const success1 = await copyToClipboard("test1");
  assert.strictEqual(success1, true, "Should return true on success");
  assert.strictEqual(clipboardText, "test1", "Should write to clipboard");
  console.log("✓ Passed");

  // Test 2: Insecure context (fallback)
  console.log("Test 2: Insecure context (fallback)");
  // Force insecure context
  Object.defineProperty(global.window, "isSecureContext", {
    value: false,
    writable: true,
  });

  // In this test setup, global.navigator.clipboard is still present.
  // copyToClipboard checks navigator.clipboard && window.isSecureContext.
  // If isSecureContext is false, it should fall back.
  // But we should also test the case where clipboard is missing?
  // Let's just rely on isSecureContext=false triggering fallback.

  execCommandCalled = false;
  const success2 = await copyToClipboard("test2");

  assert.strictEqual(success2, true, "Should return true on success");
  assert.strictEqual(
    execCommandCalled,
    true,
    'Should call document.execCommand("copy")',
  );
  console.log("✓ Passed");

  // Test 3: API failure
  console.log("Test 3: API failure handling");
  Object.defineProperty(global.window, "isSecureContext", {
    value: true,
    writable: true,
  });

  // Mock failure
  const originalWriteText = (global.navigator as any).clipboard.writeText;
  (global.navigator as any).clipboard.writeText = async () => {
    throw new Error("Clipboard error");
  };

  const success3 = await copyToClipboard("test3");
  assert.strictEqual(success3, false, "Should return false on error");
  console.log("✓ Passed");

  // Restore
  (global.navigator as any).clipboard.writeText = originalWriteText;

  console.log("All clipboard tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
