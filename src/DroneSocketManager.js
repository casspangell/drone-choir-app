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
    
    // Request state for this voice every second
    this.pollInterval = setInterval(() => {
      if (this.isConnected) {
        this.socket.emit('request-voice-state', voiceType);
      }
    }, 1000);
  }
  
  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
  
  // Send state update to the server (controller only)
  updateState(state) {
    if (!this.isConnected || this.type !== 'controller') return;
    
    this.socket.emit('state-update', state);
  }
  
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