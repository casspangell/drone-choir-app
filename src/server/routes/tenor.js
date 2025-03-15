// File: server/routes/tenor.js
const express = require('express');
const router = express.Router();

// In-memory storage for tenor voice state
let tenorState = {
  isPlaying: false,
  noteQueue: [],
  lastUpdated: Date.now()
};

// GET endpoint to retrieve tenor state
router.get('/api/voice/tenor', (req, res) => {
  res.json(tenorState);
});

// POST endpoint to update tenor state
router.post('/api/voice/tenor/state', (req, res) => {
  const { isPlaying } = req.body;
  
  if (isPlaying !== undefined) {
    tenorState = {
      ...tenorState,
      isPlaying,
      lastUpdated: Date.now()
    };
    
    res.json({ success: true, state: tenorState });
  } else {
    res.status(400).json({ error: 'Missing isPlaying property' });
  }
});

// POST endpoint to add notes to queue
router.post('/api/voice/tenor/queue', (req, res) => {
  const { notes } = req.body;
  
  if (Array.isArray(notes)) {
    tenorState = {
      ...tenorState,
      noteQueue: [...tenorState.noteQueue, ...notes],
      lastUpdated: Date.now()
    };
    
    res.json({ success: true, state: tenorState });
  } else {
    res.status(400).json({ error: 'Notes must be an array' });
  }
});

// DELETE endpoint to clear queue
router.delete('/api/voice/tenor/queue', (req, res) => {
  tenorState = {
    ...tenorState,
    noteQueue: [],
    lastUpdated: Date.now()
  };
  
  res.json({ success: true, state: tenorState });
});

module.exports = router;