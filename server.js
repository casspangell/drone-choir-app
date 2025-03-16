const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { networkInterfaces } = require('os');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let lastStateUpdateTime = 0;

// Define currentState ONCE at the top level
let currentState = {
  isPlaying: false,
  voices: {
    soprano: { isPlaying: false, currentNote: null, nextNote: null },
    alto: { isPlaying: false, currentNote: null, nextNote: null },
    tenor: { isPlaying: false, currentNote: null, nextNote: null },
    bass: { isPlaying: false, currentNote: null, nextNote: null }
  }
};

// Serve static files from the React build folder
app.use(express.static(path.join(__dirname, 'build')));

// Serve the React app for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Function to get local IP addresses
const getLocalIPs = () => {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  
  return results;
};

// Socket.IO connection handler - ONLY ONE of these blocks!
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle client registration
  socket.on('register', (data) => {
    console.log('Client registered:', data, 'socket ID:', socket.id);
    
    if (data.type === 'controller') {
      // Only one controller allowed
      socket.join('controllers');
      console.log('Controller registered:', socket.id);
      socket.emit('registration-success', { type: 'controller' });
    } else if (data.type === 'viewer') {
      socket.join('viewers');
      console.log('Viewer registered:', socket.id, 'for voice:', data.voiceType);
      console.log('Current viewers in room:', Array.from(io.sockets.adapter.rooms.get('viewers') || []));
      
      socket.emit('registration-success', { 
        type: 'viewer',
        initialState: currentState
      });
    }
  });

  // Handle state updates from controller (main dashboard)
  socket.on('state-update', (newState) => {
    const now = Date.now();
    console.log(`State update received at ${now}, ${now - lastStateUpdateTime}ms since last update`);
    lastStateUpdateTime = now;
    
    console.log('Received state update from controller:', 
                newState.isPlaying ? 'playing' : 'stopped',
                Object.keys(newState.voices || {}).map(v => 
                 `${v}: ${newState.voices[v].isPlaying ? 'playing' : 'stopped'}`).join(', '));
    
    // Create a complete deep copy of the new state
    currentState = JSON.parse(JSON.stringify(newState));
    
    // Log the updated state
    console.log('Updated current state:', 
                currentState.isPlaying ? 'playing' : 'stopped',
                Object.keys(currentState.voices || {}).map(v => 
                 `${v}: ${currentState.voices[v].isPlaying ? 'playing' : 'stopped'}`).join(', '));
    
    // Broadcast to all viewers as a direct broadcast
    const viewers = Array.from(io.sockets.adapter.rooms.get('viewers') || []);
    console.log(`Broadcasting to ${viewers.length} viewers`);
    
    // Use io.to instead of socket.to to ensure broadcast from the server itself
    io.to('viewers').emit('state-updated', currentState);
  });

  // Handle specific voice requests
  socket.on('request-voice-state', (voiceType) => {
    console.log(`Voice state requested for ${voiceType}`);
    
    // Log the entire current state to diagnose the issue
    console.log('Current state stored on server:', 
                currentState.isPlaying ? 'playing' : 'stopped',
                Object.keys(currentState.voices || {}).map(v => 
                `${v}: ${currentState.voices[v]?.isPlaying ? 'playing' : 'stopped'}`).join(', '));
    
    // Send the state for the requested voice
    if (currentState.voices && currentState.voices[voiceType]) {
      console.log(`Sending ${voiceType} state:`, 
                  currentState.voices[voiceType].isPlaying ? 'playing' : 'stopped',
                  'Note:', currentState.voices[voiceType].currentNote?.note);
      
      socket.emit('voice-state', {
        voiceType,
        state: currentState.voices[voiceType]
      });
    } else {
      console.log(`No state available for ${voiceType}`);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Get and display all local IP addresses
  const localIPs = getLocalIPs();
  if (localIPs.length > 0) {
    console.log('\nAccess URLs:');
    localIPs.forEach(ip => {
      console.log(`http://${ip}:${PORT}`);
    });
  } else {
    console.log('\nNo network interfaces found. Try connecting with your local IP address.');
  }
});