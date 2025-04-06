const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Added missing multer import
const fs = require('fs'); // Added missing fs import
const path = require('path');
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

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads', 'audio');
// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Save with original name + timestamp to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, path.parse(file.originalname).name + '-' + uniqueSuffix + '.mp3');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only mp3 files
    if (file.mimetype === 'audio/mpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Middleware
app.use(express.json());
app.use(cors());  // Enable CORS for all routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Added to serve uploaded files

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected to API server:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from API server:', socket.id);
  });
});

// ENDPOINT to receive drone sound frequencies from Python
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
        note: v.note,
        max_gain: v.max_gain
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

// ENDPOINT to receive MP3 audio files
app.post('/api/audio-upload', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No audio file uploaded' });
    }
    
    // Get the uploaded file details
    const audioFile = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      // Create a URL that clients can use to access the file
      url: `${req.protocol}://${req.get('host')}/uploads/audio/${req.file.filename}`
    };

    // Extract any additional metadata from the request
    const metadata = {
      title: req.body.title || path.parse(req.file.originalname).name,
      description: req.body.description || 'Audio file uploaded from Python client',
      timestamp: new Date().toISOString(),
      ...req.body // Include any other fields sent in the request
    };
    
    console.log('Received audio file:', audioFile);
    console.log('With metadata:', metadata);
    
    // Emit a socket event with the file information
    io.emit('audio-file-received', {
      timestamp: new Date().toISOString(),
      source: 'python-api',
      audioFile,
      metadata
    });
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Audio file received successfully',
      file: audioFile,
      metadata
    });
    
  } catch (error) {
    console.error('Error handling audio file upload:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Error processing audio file' 
    });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Ready to receive data from Python mycelial app`);
});