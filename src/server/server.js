const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  // Add these configuration options for better stability
  perMessageDeflate: false,
  clientTracking: true,
  // Increase timeouts (in milliseconds)
  pingTimeout: 60000, // 1 minute
  pingInterval: 30000 // 30 seconds
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Enable CORS
app.use(cors());
app.use(express.json());

// Reset master status on server start
let masterClient = null;
console.log('Server starting, master reset to null');

// Track connected clients and master instance
let connectedClients = [];
let clientsMap = new Map(); // Maps instanceId to WebSocket object
let masterInstanceId = null;

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
  
  // Generate temporary ID until client registers
  ws.tempId = Math.random().toString(36).substring(2, 9);
  
  // Send current state to newly connected clients
  Object.entries(voiceStates).forEach(([voiceType, state]) => {
    ws.send(JSON.stringify({
      type: 'VOICE_STATE_UPDATE',
      voiceType,
      state,
      timing: getServerTimeInfo()
    }));
    
    if (state.noteQueue && state.noteQueue.length > 0) {
      ws.send(JSON.stringify({
        type: 'NOTES_UPDATE',
        voiceType,
        notes: state.noteQueue,
        timing: getServerTimeInfo()
      }));
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle client registration
      if (data.type === 'REGISTER_CLIENT' && data.instanceId) {
        const instanceId = data.instanceId;
        
        console.log(`Client registration received with ID: ${instanceId}`);
        
        // Remove old entry if this client already had a tempId
        if (ws.tempId && ws.tempId !== instanceId) {
          connectedClients = connectedClients.filter(id => id !== ws.tempId);
        }
        
        // Store the instance ID with this connection
        ws.instanceId = instanceId;
        
        // Check if this client was already connected (reconnection case)
        const existingConnection = clientsMap.get(instanceId);
        if (existingConnection && existingConnection !== ws) {
          console.log(`Replacing existing connection for ${instanceId}`);
          
          // Mark the old connection as being replaced to prevent reconnection loop
          existingConnection.isBeingReplaced = true;
          
          // Close the old connection if it's still open
          if (existingConnection.readyState === WebSocket.OPEN) {
            existingConnection.close();
          }
        }
        
        // Store this client in our map
        clientsMap.set(instanceId, ws);
        
        // Add to connected clients if not already there
        if (!connectedClients.includes(instanceId)) {
          connectedClients.push(instanceId);
        }
        
        // Assign master if none exists
        if (masterInstanceId === null) {
          masterInstanceId = instanceId;
          console.log(`First client ${instanceId} assigned as master`);
          
          // Notify the new master
          ws.send(JSON.stringify({
            type: 'MASTER_CHANGED',
            newMasterId: instanceId,
            timing: getServerTimeInfo()
          }));
        } else {
          // Let the client know who the master is
          ws.send(JSON.stringify({
            type: 'MASTER_CHANGED',
            newMasterId: masterInstanceId,
            timing: getServerTimeInfo()
          }));
        }
        
        return; // We've handled registration, no need to process further
      }

      // Handle PING messages to keep connection alive
      if (data.type === 'PING') {
        // Send a PONG response
        ws.send(JSON.stringify({
          type: 'PONG',
          timestamp: data.timestamp,
          serverTime: Date.now(),
          timing: getServerTimeInfo()
        }));
        return; // Skip further processing
      }
      
      // For all other messages, get the client ID from the message or the WebSocket
      const clientId = data.instanceId || ws.instanceId || ws.tempId;
      
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
            // Only allow the master to update notes
            if (clientId !== masterInstanceId) {
              console.log(`Client ${clientId} attempted to update notes but is not master`);
              
              // Notify client they're not the master
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Only the master can update notes',
                timing: getServerTimeInfo()
              }));
              
              return;
            }
            
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
    const clientId = ws.instanceId || ws.tempId;
    console.log(`Client ${clientId} disconnected from WebSocket`);
    
    // Skip cleanup if this connection is being replaced
    if (ws.isBeingReplaced) {
      console.log(`Connection for ${clientId} was replaced, skipping cleanup`);
      return;
    }
    
    // Only remove from maps if this is the current connection for this ID
    if (ws.instanceId && clientsMap.get(ws.instanceId) === ws) {
      clientsMap.delete(ws.instanceId);
      
      // Only manipulate the master if this was the current master
      if (ws.instanceId === masterInstanceId) {
        // Remove this client
        connectedClients = connectedClients.filter(id => id !== ws.instanceId);
        
        // Assign a new master if any clients remain
        masterInstanceId = connectedClients.length > 0 ? connectedClients[0] : null;
        console.log(`Master ${ws.instanceId} disconnected. New master: ${masterInstanceId}`);
        
        // Notify all clients about the new master
        if (masterInstanceId) {
          broadcastToAll({
            type: 'MASTER_CHANGED',
            newMasterId: masterInstanceId
          });
        }
      } else {
        // Just remove from connected clients
        connectedClients = connectedClients.filter(id => id !== ws.instanceId);
      }
    } else if (ws.tempId) {
      // Remove temporary ID from connected clients
      connectedClients = connectedClients.filter(id => id !== ws.tempId);
    }
  });
});

// Endpoint to check and set master status
app.post('/api/master/check', (req, res) => {
  const { instanceId } = req.body;
  
  if (!instanceId) {
    return res.status(400).json({ error: 'No instance ID provided' });
  }
  
  // Assign first client as master if no master exists
  if (masterInstanceId === null) {
    masterInstanceId = instanceId;
    console.log(`First client ${instanceId} assigned as master`);
    
    // Add to connected clients if not already there
    if (!connectedClients.includes(instanceId)) {
      connectedClients.push(instanceId);
    }
  }
  
  const isMaster = (masterInstanceId === instanceId);
  console.log(`Client ${instanceId} checking status: ${isMaster ? 'MASTER' : 'SLAVE'}`);
  
  res.json({ isMaster });
});

// Endpoint to release master role (when a master disconnects)
app.post('/api/master/release', (req, res) => {
  const { instanceId } = req.body;
  
  if (instanceId && instanceId === masterInstanceId) {
    // This was the master, so release the role
    connectedClients = connectedClients.filter(id => id !== instanceId);
    masterInstanceId = connectedClients.length > 0 ? connectedClients[0] : null;
    console.log(`Master ${instanceId} released. New master: ${masterInstanceId}`);
    
    // Notify all clients about the new master
    if (masterInstanceId) {
      broadcastToAll({
        type: 'MASTER_CHANGED',
        newMasterId: masterInstanceId
      });
    }
  } else {
    // Just remove from connected clients
    connectedClients = connectedClients.filter(id => id !== instanceId);
  }
  
  // Remove from client map
  clientsMap.delete(instanceId);
  console.log(`Client ${instanceId} disconnected. Total clients: ${connectedClients.length}`);
  
  res.json({ success: true });
});

// Endpoint to reset master (for testing)
app.post('/api/master/reset', (req, res) => {
  masterInstanceId = null;
  console.log('Master reset to null');
  res.json({ success: true });
});

// GET endpoint to retrieve voice state
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
  const { isPlaying, instanceId } = req.body;
  
  // Only allow the master to update state
  if (instanceId !== masterInstanceId) {
    return res.status(403).json({ error: 'Only the master can update voice state' });
  }
  
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
  const { notes, instanceId } = req.body;
  
  // Only allow the master to update notes
  if (instanceId && instanceId !== masterInstanceId) {
    return res.status(403).json({ error: 'Only the master can update notes' });
  }
  
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
  const { pitch, note, duration, instanceId } = req.body;
  
  // Only allow the master to trigger unison
  if (instanceId && instanceId !== masterInstanceId) {
    return res.status(403).json({ error: 'Only the master can trigger unison' });
  }
  
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