
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Mock data for captures
const mockCaptures = [
    {
        name: 'screenshot1.png',
        url: '/captures/screenshot1.png',
        size: 1024 * 50, // 50KB
        modified: Date.now(),
        type: 'screenshot'
    },
    {
        name: 'recording1.webm',
        url: '/captures/recording1.webm',
        size: 1024 * 1024 * 2.5, // 2.5MB
        modified: Date.now() - 100000,
        type: 'recording'
    }
];

// API endpoint to serve mock captures
app.get('/api/data/captures', (req, res) => {
    res.json({ captures: mockCaptures });
});

// Start the server
app.listen(port, () => {
    console.log(`Mock server listening at http://localhost:${port}`);
});
