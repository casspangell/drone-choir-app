const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.API_PORT || 3000;

// Import your existing DroneSocketManager to communicate with the voice modules
const socketManager = require('./src/DroneSocketManager').default;
// Import your voice note utilities
const { getNoteName } = require('./src/voiceTypes');

// Middleware
app.use(express.json());
app.use(cors());  // Enable CORS for all routes

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected to API server:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from API server:', socket.id);
  });
});

// Endpoint to receive drone sound frequencies from Python
app.post('/api/drone-update', (req, res) => {
  const data = req.body;
  console.log('Received drone update data:', JSON.stringify(data, null, 2));
  
  // Broadcast to all connected clients
  io.emit('api-input-received', {
    timestamp: new Date().toISOString(),
    source: 'python-api',
    data: {
      voices: data.voices.map(v => ({
        voice_type: v.voice_type,
        frequency: v.frequency,
        duration: v.duration,
        note: v.note
      }))
    }
  });
  
  // Process voice data if it exists
  if (data.voices && Array.isArray(data.voices)) {
    // Rest of your existing code...
  }
  
  res.status(200).json({ 
    status: 'success', 
    message: 'Drone sound data received and added to voice queues' 
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Ready to receive data from Python mycelial app`);
});