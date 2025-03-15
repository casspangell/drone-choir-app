const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable CORS
app.use(cors());
app.use(express.json());

// Shared state for all voice types
const voiceStates = {
  tenor: {
    isPlaying: false,
    noteQueue: [],
    lastUpdated: Date.now()
  },
  bass: {
    isPlaying: false,
    noteQueue: [],
    lastUpdated: Date.now()
  },
  alto: {
    isPlaying: false,
    noteQueue: [],
    lastUpdated: Date.now()
  },
  soprano: {
    isPlaying: false,
    noteQueue: [],
    lastUpdated: Date.now()
  }
};

// Voice ID to type mapping
const voiceIdToType = {
  1: 'soprano',
  2: 'alto',
  3: 'tenor',
  4: 'bass'
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'REQUEST_FREQUENCIES':
          // Just log it, no state change needed
          break;
          
        case 'START_STREAM':
          // Update the corresponding voice state when a stream starts
          if (data.frequencyId && voiceIdToType[data.frequencyId]) {
            const voiceType = voiceIdToType[data.frequencyId];
            voiceStates[voiceType].isPlaying = true;
            voiceStates[voiceType].lastUpdated = Date.now();
            console.log(`Updated ${voiceType} state to playing`);
          }
          break;
          
        case 'STOP_STREAM':
          // Update the corresponding voice state when a stream stops
          if (data.frequencyId && voiceIdToType[data.frequencyId]) {
            const voiceType = voiceIdToType[data.frequencyId];
            voiceStates[voiceType].isPlaying = false;
            voiceStates[voiceType].lastUpdated = Date.now();
            console.log(`Updated ${voiceType} state to not playing`);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// GET endpoint to retrieve tenor state
app.get('/api/voice/tenor', (req, res) => {
  console.log('GET request received for tenor state');
  res.json(voiceStates.tenor);
});

// POST endpoint to update tenor state
app.post('/api/voice/tenor/state', (req, res) => {
  console.log('POST request received for tenor state:', req.body);
  const { isPlaying } = req.body;
  
  voiceStates.tenor = {
    ...voiceStates.tenor,
    isPlaying,
    lastUpdated: Date.now()
  };
  
  res.json({ success: true, state: voiceStates.tenor });
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});