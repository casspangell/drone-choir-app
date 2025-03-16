const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { networkInterfaces } = require('os');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the React build folder
app.use(express.static(path.join(__dirname, 'build')));

// Serve the React app for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle socket events here
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
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

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Store current state to share with new clients
  let currentState = {
    isPlaying: false,
    voices: {
      soprano: { isPlaying: false, currentNote: null, nextNote: null },
      alto: { isPlaying: false, currentNote: null, nextNote: null },
      tenor: { isPlaying: false, currentNote: null, nextNote: null },
      bass: { isPlaying: false, currentNote: null, nextNote: null }
    }
  };
  
  // Handle client registration
  socket.on('register', (data) => {
    console.log('Client registered:', data);
    
    if (data.type === 'controller') {
      // This is the main dashboard
      socket.join('controllers');
      socket.emit('registration-success', { type: 'controller' });
    } else if (data.type === 'viewer') {
      // This is a single voice page
      socket.join('viewers');
      socket.emit('registration-success', { 
        type: 'viewer',
        initialState: currentState
      });
    }
  });

  // Handle state updates from controller (main dashboard)
socket.on('state-update', (newState) => {
  console.log('Received state update from controller:', 
              newState.isPlaying ? 'playing' : 'stopped',
              Object.keys(newState.voices || {}).map(v => 
               `${v}: ${newState.voices[v].isPlaying ? 'playing' : 'stopped'}`).join(', '));
  
  // Store the updated state
  currentState = newState;
  
  // Log the stored state
  console.log('Updated current state:', 
              currentState.isPlaying ? 'playing' : 'stopped',
              Object.keys(currentState.voices || {}).map(v => 
               `${v}: ${currentState.voices[v].isPlaying ? 'playing' : 'stopped'}`).join(', '));
  
  // Broadcast to all viewers
  socket.to('viewers').emit('state-updated', newState);
});

// Handle specific voice requests
socket.on('request-voice-state', (voiceType) => {
  console.log(`Voice state requested for ${voiceType}`);
  
  // Send the state for the requested voice
  if (currentState.voices && currentState.voices[voiceType]) {
    console.log(`Sending ${voiceType} state: ${currentState.voices[voiceType].isPlaying ? 'playing' : 'stopped'}`);
    
    socket.emit('voice-state', {
      voiceType,
      state: currentState.voices[voiceType]
    });
  } else {
    console.log(`No state available for ${voiceType}`);
  }
});
  
  // Handle state updates from controller (main dashboard)
  // socket.on('state-update', (newState) => {
  //   // Store the updated state
  //   currentState = newState;
    
  //   // Broadcast to all viewers
  //   socket.to('viewers').emit('state-updated', newState);
  // });
  
  // Handle specific voice requests
  // socket.on('request-voice-state', (voiceType) => {
  //   // Send the state for the requested voice
  //   if (currentState.voices[voiceType]) {
  //     socket.emit('voice-state', {
  //       voiceType,
  //       state: currentState.voices[voiceType]
  //     });
  //   }
  // });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});