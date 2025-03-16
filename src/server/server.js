const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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

// Broadcast to all clients
function broadcastToAll(data) {
  // Add server time info to all broadcasts
  const dataWithTiming = {
    ...data,
    timing: getServerTimeInfo()
  };
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(dataWithTiming));
    }
  });
}

function getServerTimeInfo() {
  return {
    serverTime: Date.now(),
    timeOffset: 500  // Offset in milliseconds to account for network latency
  };
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send current state to newly connected clients
  Object.entries(voiceStates).forEach(([voiceType, state]) => {
    voiceStates[voiceType].noteQueue = [];
    voiceStates[voiceType].isPlaying = false;
    voiceStates[voiceType].lastUpdated = Date.now();
  
    ws.send(JSON.stringify({
      type: 'VOICE_STATE_UPDATE',
      voiceType,
      state
    }));
    
    if (state.noteQueue && state.noteQueue.length > 0) {
      ws.send(JSON.stringify({
        type: 'NOTES_UPDATE',
        voiceType,
        notes: state.noteQueue
      }));
    }
  });

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
            
            // Add note information from the main app
            if (data.note) {
              voiceStates[voiceType].noteQueue = [data.note];
            }
            
            voiceStates[voiceType].lastUpdated = Date.now();
            console.log(`Updated ${voiceType} state to playing`);
            
            // Broadcast state update to all clients
            broadcastToAll({
              type: 'VOICE_STATE_UPDATE',
              voiceType,
              state: voiceStates[voiceType]
            });
          }
          break;
        
        case 'STOP_STREAM':
          // Update the corresponding voice state when a stream stops
          if (data.frequencyId && voiceIdToType[data.frequencyId]) {
            const voiceType = voiceIdToType[data.frequencyId];
            voiceStates[voiceType].isPlaying = false;
            voiceStates[voiceType].lastUpdated = Date.now();
            console.log(`Updated ${voiceType} state to not playing`);
            
            // Broadcast state update to all clients
            broadcastToAll({
              type: 'VOICE_STATE_UPDATE',
              voiceType,
              state: voiceStates[voiceType]
            });
          }
          break;
          
        case 'UPDATE_NOTES':
          if (data.voiceType && data.notes) {
            voiceStates[data.voiceType].noteQueue = data.notes;
            voiceStates[data.voiceType].lastUpdated = Date.now();
            
            // Broadcast notes update to all clients
            broadcastToAll({
              type: 'NOTES_UPDATE',
              voiceType: data.voiceType,
              notes: data.notes
            });
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
app.get('/api/voice/:voiceType', (req, res) => {
  const { voiceType } = req.params;
  
  if (voiceStates[voiceType]) {
    console.log(`SERVER ${voiceType} state requested:`, voiceStates[voiceType].noteQueue?.map(note => ({
      note: note.note,
      frequency: note.frequency.toFixed(2),
      duration: note.duration?.toFixed(2)
    })));
    
    res.json(voiceStates[voiceType]);
  } else {
    res.status(404).json({ error: 'Voice type not found' });
  }
});

// POST endpoint to update voice state
app.post('/api/voice/:voiceType/state', (req, res) => {
  const { voiceType } = req.params;
  const { isPlaying } = req.body;
  
  if (voiceStates[voiceType]) {
    voiceStates[voiceType] = {
      ...voiceStates[voiceType],
      isPlaying,
      lastUpdated: Date.now()
    };
    
    // Broadcast state update to all clients
    broadcastToAll({
      type: 'VOICE_STATE_UPDATE',
      voiceType,
      state: voiceStates[voiceType]
    });
    
    res.json({ success: true, state: voiceStates[voiceType] });
  } else {
    res.status(404).json({ error: 'Voice type not found' });
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
    
    // Broadcast notes update to all clients
    broadcastToAll({
      type: 'NOTES_UPDATE',
      voiceType,
      notes
    });
    
    res.json({ success: true, state: voiceStates[voiceType] });
  } else {
    res.status(400).json({ error: 'Invalid voice type or notes format' });
  }
});

// When handling the unison feature, add this code to ensure synchronized playback
app.post('/api/unison', (req, res) => {
  const { pitch, note, duration } = req.body;
  
  if (pitch && note) {
    // Create a note object with scheduled start time
    const startTime = Date.now() + 1000; // Schedule 1 second in the future
    
    const unisonNote = {
      frequency: pitch,
      duration: duration || 10,
      note: note,
      scheduledStartTime: startTime
    };
    
    // Update all voice states
    Object.keys(voiceStates).forEach(voiceType => {
      voiceStates[voiceType].noteQueue = [unisonNote];
      voiceStates[voiceType].isPlaying = true;
      voiceStates[voiceType].lastUpdated = Date.now();
      
      // Broadcast notes update to all clients with timing info
      broadcastToAll({
        type: 'NOTES_UPDATE',
        voiceType,
        notes: [unisonNote]
      });
      
      // Broadcast state update to all clients
      broadcastToAll({
        type: 'VOICE_STATE_UPDATE',
        voiceType,
        state: voiceStates[voiceType]
      });
    });
    
    console.log('All voices set to unison note:', note);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Missing pitch or note information' });
  }
});