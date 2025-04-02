// DroneSocketManager.js
import { io } from 'socket.io-client';

class DroneSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.type = null; // 'controller' or 'viewer'
    this.listeners = {};
    this.pollInterval = null;
  }
  
  // Connect to the WebSocket server
  connect() {
    if (this.socket) return;
    
    // Connect to the socket server
    this.socket = io();
    
    // Set up connection events
    this.socket.on('connect', () => {
      console.log('Connected to socket server');
      this.isConnected = true;
      this.notifyListeners('connect');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      this.isConnected = false;
      this.notifyListeners('disconnect');
    });
    
    // Handle registration response
    this.socket.on('registration-success', (data) => {
      console.log('Registration successful:', data);
      this.type = data.type;
      
      if (data.initialState) {
        this.notifyListeners('initial-state', data.initialState);
      }
      
      this.notifyListeners('registered', data);
    });
    
    // Handle state updates
    this.socket.on('state-updated', (data) => {
      this.notifyListeners('state-updated', data);
    });
    
    // Handle specific voice state updates
    this.socket.on('voice-state', (data) => {
      this.notifyListeners('voice-state', data);
    });

    this.socket.on('state-updated', (data) => {
      console.log('Received state update from server:', data);
      this.notifyListeners('state-updated', data);
    });

    this.socket.on('voice-state', (data) => {
      console.log('Received voice state from server:', data);
      this.notifyListeners('voice-state', data);
    });
  }
  
  // Register as a controller (main dashboard) or viewer (single voice)
  register(type, voiceType = null) {
    if (!this.isConnected) {
      console.warn('Not connected to server, cannot register');
      return;
    }
    
    this.socket.emit('register', { 
      type,
      voiceType
    });
    
    // If this is a viewer with a specific voice, start polling
    if (type === 'viewer' && voiceType) {
      this.startPolling(voiceType);
    }
  }
  
  // Start polling for a specific voice's state
  startPolling(voiceType) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    console.log(`Starting polling for ${voiceType} state`);
    
    // Request state for this voice every second
    this.pollInterval = setInterval(() => {
      if (this.isConnected) {
        console.log(`Requesting state for ${voiceType}`);
        this.socket.emit('request-voice-state', voiceType);
      }
    }, 500); // Poll more frequently
  }
  
  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Get current state
getCurrentState() {
  return this._currentState || {
    isPlaying: false,
    voices: {
      soprano: { isPlaying: false, currentNote: null, nextNote: null },
      alto: { isPlaying: false, currentNote: null, nextNote: null },
      tenor: { isPlaying: false, currentNote: null, nextNote: null },
      bass: { isPlaying: false, currentNote: null, nextNote: null }
    }
  };
}

// Store current state
_setCurrentState(state) {
  this._currentState = state;
}

// Enhanced updateState method
updateState(state) {
  if (!this.isConnected) return;
  
  // Store the current state
  this._setCurrentState(state);
  
  // Send to server
  this.socket.emit('state-update', state);
  
  // Also notify local listeners
  this.notifyListeners('state-updated', state);
}
  
  // // Send state update to the server (controller only)
  // updateState(state) {
  //   if (!this.isConnected || this.type !== 'controller') return;
    
  //   this.socket.emit('state-update', state);
  // }
  
  // Add event listener
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
  }
  
  // Remove event listener
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  // Notify listeners of an event
  notifyListeners(event, data) {
    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
  
  // Disconnect from the server
  disconnect() {
    this.stopPolling();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
  }
}

// Create singleton instance
const socketManager = new DroneSocketManager();

export default socketManager;