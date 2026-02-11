const { Mutex } = require('./utils');

const taskMutex = new Mutex();
const executionStreams = new Map();
const stopRequests = new Set();

const sendExecutionUpdate = (runId, payload) => {
    if (!runId) return;
    const clients = executionStreams.get(runId);
    if (!clients || clients.size === 0) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    clients.forEach((res) => {
        try {
            res.write(data);
        } catch {
            // ignore
        }
    });
};

module.exports = {
    taskMutex,
    executionStreams,
    stopRequests,
    sendExecutionUpdate
};
