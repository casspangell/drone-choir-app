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
  
  // Send current state to newly connected clients
  Object.entries(voiceStates).forEach(([voiceType, state]) => {
    if (state.noteQueue && state.noteQueue.length > 0) {
      ws.send(JSON.stringify({
        type: 'NOTES_UPDATE',
        voiceType,
        notes: state.noteQueue
      }));
    }
  });

  // Add this new message type handler
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'REQUEST_FREQUENCIES':
          // Just log it, no state change needed
          break;
          
          // When handling WebSocket START_STREAM messages:
          case 'START_STREAM':
            // Update the corresponding voice state when a stream starts
            if (data.frequencyId && voiceIdToType[data.frequencyId]) {
              const voiceType = voiceIdToType[data.frequencyId];
              voiceStates[voiceType].isPlaying = true;
              
              // Add this to capture note information from the main app
              if (data.note) {
                voiceStates[voiceType].noteQueue = [data.note];
              }
              
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
  console.log('SERVER tenor state requested, queue:', voiceStates.tenor.noteQueue?.map(note => ({
    note: note.note,
    frequency: note.frequency.toFixed(2),
    duration: note.duration?.toFixed(2)
  })));
  
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

app.post('/api/voice/tenor/notes', (req, res) => {
  console.log('SERVER received tenor notes update:', req.body.notes?.map(note => ({
    note: note.note,
    frequency: note.frequency.toFixed(2),
    duration: note.duration?.toFixed(2)
  })));
  
  const { notes } = req.body;
  
  if (Array.isArray(notes)) {
    voiceStates.tenor.noteQueue = notes;
    voiceStates.tenor.lastUpdated = Date.now();
  }
  
  res.json({ success: true, state: voiceStates.tenor });
});

app.post('/api/unison', (req, res) => {
  const { pitch, note, duration } = req.body;
  
  if (pitch && note) {
    // Create a note object
    const unisonNote = {
      frequency: pitch,
      duration: duration || 10,
      note: note
    };
    
    // Update all voice states
    Object.keys(voiceStates).forEach(voiceType => {
      voiceStates[voiceType].noteQueue = [unisonNote];
      voiceStates[voiceType].isPlaying = true;
      voiceStates[voiceType].lastUpdated = Date.now();
    });
    
    console.log('All voices set to unison note:', note);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Missing pitch or note information' });
  }
});

// POST endpoint for updating a voice's note queue
app.post('/api/voice/:voiceType/notes', (req, res) => {
  const { voiceType } = req.params;
  const { notes } = req.body;
  
  if (voiceStates[voiceType] && Array.isArray(notes)) {
    voiceStates[voiceType].noteQueue = notes;
    voiceStates[voiceType].lastUpdated = Date.now();
    console.log(`Updated ${voiceType} notes:`, notes);
    res.json({ success: true, state: voiceStates[voiceType] });
  } else {
    res.status(400).json({ error: 'Invalid voice type or notes format' });
  }
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});