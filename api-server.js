const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());  // Enable CORS for all routes

// Endpoint to receive drone choir updates from Python
app.post('/api/drone-update', (req, res) => {
  const data = req.body;
  console.log('Received drone choir update data:');
  console.log(JSON.stringify(data, null, 2));
  
  // Here you could:
  // 1. Update your drone choir state
  // 2. Emit events to your UI
  // 3. Trigger audio changes
  
  // This is a good place to integrate with existing components
  // For example, if you have something like a sound engine:
  // soundEngine.updateParameters(data.performance_data);
  
  // Or if you're using socket.io for realtime updates:
  // io.emit('drone-update', data);
  
  res.status(200).json({ 
    status: 'success', 
    message: 'Drone choir data received and processing' 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Ready to receive data from Python mycelial app`);
});