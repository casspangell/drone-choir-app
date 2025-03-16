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