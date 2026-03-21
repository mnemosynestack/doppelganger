const express = require('express');
const { getPool } = require('../db');

const router = express.Router();
const startTime = Date.now();

router.get('/', async (req, res) => {
    const status = { status: 'ok', uptime: Math.floor((Date.now() - startTime) / 1000) };

    const pool = getPool();
    if (pool) {
        status.storage = 'postgres';
        try {
            await pool.query('SELECT 1');
        } catch (err) {
            status.status = 'degraded';
            status.storage_error = 'Database unreachable';
        }
    } else {
        status.storage = 'json';
    }

    const httpStatus = status.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(status);
});

module.exports = router;
