const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { VOICE_RANGES } = require('../src/voiceTypes');

const FREQUENCIES = Object.values(VOICE_RANGES).map(voice => ({
  id: voice.id,
  hertz: voice.hertz,
  voiceType: voice.label.split(' ')[0].toLowerCase(),
  note: voice.note
}));

// Express and WebSocket server setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Shared state for active connections and streaming
const activeConnections = new Set();
const streamingClients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('New client connected');
    activeConnections.add(ws);

    // Send initial frequency configurations
    ws.send(JSON.stringify({
        type: 'FREQUENCY_CONFIG',
        frequencies: FREQUENCIES
    }));

    // Handle incoming messages
    ws.on('message', (messageData) => {
        try {
            const message = JSON.parse(messageData);
            
            switch(message.type) {
                case 'START_STREAM':
                    handleStartStream(ws, message);
                    break;
                case 'STOP_STREAM':
                    handleStopStream(ws, message);
                    break;
                case 'REQUEST_FREQUENCIES':
                    sendFrequencyList(ws);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        activeConnections.delete(ws);
        
        // Clean up any streaming for this client
        for (const [freqId, clients] of streamingClients.entries()) {
            clients.delete(ws);
            if (clients.size === 0) {
                streamingClients.delete(freqId);
            }
        }
    });
});

// Handle starting a stream for a specific frequency
function handleStartStream(ws, message) {
    const { frequencyId } = message;
    const frequencyData = FREQUENCIES.find(f => f.id === frequencyId);
    
    if (!frequencyData) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Invalid frequency ID'
        }));
        return;
    }

    // Add this client to the streaming set for this frequency
    if (!streamingClients.has(frequencyId)) {
        streamingClients.set(frequencyId, new Set());
    }
    streamingClients.get(frequencyId).add(ws);

    // Send confirmation of stream start
    ws.send(JSON.stringify({
        type: 'STREAM_STARTED',
        frequency: frequencyData
    }));

    console.log(`Client started streaming frequency ${frequencyId}: ${frequencyData.hertz} Hz`);
}

// Handle stopping a stream for a specific frequency
function handleStopStream(ws, message) {
    const { frequencyId } = message;
    
    if (streamingClients.has(frequencyId)) {
        const clients = streamingClients.get(frequencyId);
        clients.delete(ws);

        // Remove the frequency if no clients are streaming it
        if (clients.size === 0) {
            streamingClients.delete(frequencyId);
        }

        ws.send(JSON.stringify({
            type: 'STREAM_STOPPED',
            frequencyId
        }));

        console.log(`Client stopped streaming frequency ${frequencyId}`);
    }
}

// Send the list of available frequencies
function sendFrequencyList(ws) {
    ws.send(JSON.stringify({
        type: 'FREQUENCY_LIST',
        frequencies: FREQUENCIES
    }));
}

// Server configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`Streaming server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.close(() => {
        console.log('WebSocket server closed');
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
});

module.exports = { server, wss };