const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.API_PORT || 3000;

// Add socket.io integration for drone-choir
const socketManager = require('./src/DroneSocketManager').default;

// Middleware
app.use(express.json());
app.use(cors());  // Enable CORS for all routes

// Endpoint to receive drone sound frequencies from Python
app.post('/api/drone-update', (req, res) => {
  const data = req.body;
  console.log('Received drone update data:', data);
  
  // Process voice data if it exists
  if (data.voices && Array.isArray(data.voices)) {
    // Pass the voice data to the Voice Modules via socket manager
    updateVoiceModules(data.voices);
  }
  
  res.status(200).json({ 
    status: 'success', 
    message: 'Drone sound data received and processing' 
  });
});

// Function to update voice modules
function updateVoiceModules(voices) {
  // Mapping between voice types and their indices in the data
  const voiceMap = {
    0: 'soprano',
    1: 'alto',
    2: 'tenor',
    3: 'bass'
  };
  
  // Process each voice data
  voices.forEach((voiceData, index) => {
    const voiceType = voiceMap[index];
    if (!voiceType) return; // Skip if not a valid voice type
    
    // Create a note object in the format expected by VoiceModule
    const note = {
      frequency: voiceData.frequency,
      duration: voiceData.duration || 10, // Default 10 seconds if not specified
      note: voiceData.note || null // The note name will be calculated if not provided
    };
    
    // Use socket manager to update the state
    updateVoiceState(voiceType, note);
  });
}

// Update voice state through the socket manager
function updateVoiceState(voiceType, note) {
  // Get the current state from socket manager if available
  let currentState = socketManager.getCurrentState && socketManager.getCurrentState() || {
    isPlaying: true,
    voices: {}
  };
  
  // Ensure voices object exists
  if (!currentState.voices) {
    currentState.voices = {};
  }
  
  // Ensure this voice exists in the state
  if (!currentState.voices[voiceType]) {
    currentState.voices[voiceType] = {
      isPlaying: true,
      currentNote: null,
      nextNote: null,
      queue: []
    };
  }
  
  // Add the note to the queue or set as next note
  if (!currentState.voices[voiceType].currentNote) {
    currentState.voices[voiceType].currentNote = note;
  } else if (!currentState.voices[voiceType].nextNote) {
    currentState.voices[voiceType].nextNote = note;
  } else {
    // Add to queue if not already there
    if (!currentState.voices[voiceType].queue) {
      currentState.voices[voiceType].queue = [];
    }
    currentState.voices[voiceType].queue.push(note);
  }
  
  // Update the state through socket manager
  if (socketManager.updateState) {
    socketManager.updateState(currentState);
    console.log(`Updated ${voiceType} with new note: ${note.frequency} Hz`);
  } else {
    console.warn('Socket manager does not have updateState method');
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Ready to receive data from Python mycelial app`);
});