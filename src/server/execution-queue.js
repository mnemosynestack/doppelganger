/**
 * Execution concurrency limiter.
 * When MAX_CONCURRENT_EXECUTIONS is set, queues excess requests.
 * When unset, all requests pass through immediately (backward compatible).
 */

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXECUTIONS) || 0; // 0 = unlimited

let activeCount = 0;
const waitQueue = [];

/**
 * Acquire a slot. Resolves immediately if under limit or unlimited.
 * Returns a release function that MUST be called when execution completes.
 */
function acquire() {
    if (MAX_CONCURRENT <= 0) {
        // Unlimited mode — no-op release
        return Promise.resolve(() => {});
    }

    if (activeCount < MAX_CONCURRENT) {
        activeCount++;
        return Promise.resolve(release);
    }

    // Queue the request
    return new Promise((resolve) => {
        waitQueue.push(() => {
            activeCount++;
            resolve(release);
        });
    });
}

function release() {
    activeCount--;
    if (waitQueue.length > 0) {
        const next = waitQueue.shift();
        next();
    }
}

/**
 * Express middleware that gates execution behind the concurrency limiter.
 * If MAX_CONCURRENT_EXECUTIONS is not set, passes through immediately.
 */
function concurrencyGate(req, res, next) {
    if (MAX_CONCURRENT <= 0) {
        return next();
    }

    acquire().then((releaseFn) => {
        res.locals._releaseExecution = releaseFn;
        res.on('finish', releaseFn);
        res.on('close', releaseFn);

        // Prevent double-release
        let released = false;
        const safeRelease = () => {
            if (!released) {
                released = true;
                releaseFn();
            }
        };
        res.locals._releaseExecution = safeRelease;
        res.removeAllListeners('finish');
        res.removeAllListeners('close');
        res.on('finish', safeRelease);
        res.on('close', safeRelease);

        next();
    });
}

function getStatus() {
    return {
        maxConcurrent: MAX_CONCURRENT || 'unlimited',
        active: activeCount,
        queued: waitQueue.length
    };
}

module.exports = { acquire, concurrencyGate, getStatus };
