let instance = null;
let instanceId = null;

// Export the function directly
export default function getWebSocketInstance(url = 'ws://localhost:8080') {
  if (!instance || instance.readyState === WebSocket.CLOSED) {
    // Try to get existing ID from localStorage
    instanceId = localStorage.getItem('droneChoirInstanceId');
    if (!instanceId) {
      // Generate a new ID and save it
      instanceId = Math.random().toString(36).substring(2, 9);
      localStorage.setItem('droneChoirInstanceId', instanceId);
    }
    
    instance = new WebSocket(url);
    console.log(`Creating singleton WebSocket connection with ID: ${instanceId}`);
    
    // Send instance ID on connection
    instance.addEventListener('open', () => {
      instance.send(JSON.stringify({
        type: 'REGISTER_CLIENT',
        instanceId
      }));
    });
  }
  return instance;
}