import { io } from 'socket.io-client';

class DroneSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isController = false;
    this.listeners = {};
    this.heartbeatInterval = null;
  }
  
  /**
   * Connect to the socket server
   */
  connect() {
    // Connect to the server (automatically uses the current host)
    this.socket = io();
    
    // Set up event handlers
    this.socket.on('connect', this.handleConnect.bind(this));
    this.socket.on('disconnect', this.handleDisconnect.bind(this));
    this.socket.on('registration-success', this.handleRegistrationSuccess.bind(this));
    this.socket.on('registration-failed', this.handleRegistrationFailed.bind(this));
    this.socket.on('state-updated', this.handleStateUpdate.bind(this));
    this.socket.on('controller-status', this.handleControllerStatus.bind(this));
    this.socket.on('controller-heartbeat', this.handleControllerHeartbeat.bind(this));
  }
  
  /**
   * Register as controller or viewer
   * @param {string} type - 'controller' or 'viewer'
   */
  register(type) {
    if (!this.isConnected) {
      console.warn('Not connected to server');
      return;
    }
    
    this.socket.emit('register', { type });
  }
  
  /**
   * Send state update to server (controller only)
   * @param {Object} state - Current state
   */
  updateState(state) {
    if (!this.isConnected || !this.isController) {
      return;
    }
    
    this.socket.emit('state-update', state);
  }
  
  /**
   * Start sending heartbeat to server (controller only)
   */
  startHeartbeat() {
    if (!this.isController) return;
    
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Send heartbeat every second
    this.heartbeatInterval = setInterval(() => {
      this.socket.emit('heartbeat');
    }, 1000);
  }
  
  /**
   * Stop sending heartbeat to server
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
  }
  
  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
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
  
  /**
   * Handle socket connection
   */
  handleConnect() {
    console.log('Connected to server');
    this.isConnected = true;
    this.notifyListeners('connect', null);
  }
  
  /**
   * Handle socket disconnection
   */
  handleDisconnect() {
    console.log('Disconnected from server');
    this.isConnected = false;
    this.isController = false;
    this.stopHeartbeat();
    this.notifyListeners('disconnect', null);
  }
  
  /**
   * Handle successful registration
   * @param {Object} data - Registration data
   */
  handleRegistrationSuccess(data) {
    console.log('Registration successful:', data);
    
    if (data.type === 'controller') {
      this.isController = true;
      this.startHeartbeat();
    }
    
    this.notifyListeners('registration-success', data);
  }
  
  /**
   * Handle failed registration
   * @param {Object} data - Error data
   */
  handleRegistrationFailed(data) {
    console.warn('Registration failed:', data);
    this.notifyListeners('registration-failed', data);
  }
  
  /**
   * Handle state update from server
   * @param {Object} state - New state
   */
  handleStateUpdate(state) {
    this.notifyListeners('state-updated', state);
  }
  
  /**
   * Handle controller status update
   * @param {Object} data - Controller status data
   */
  handleControllerStatus(data) {
    this.notifyListeners('controller-status', data);
  }
  
  /**
   * Handle controller heartbeat
   * @param {Object} data - Heartbeat data
   */
  handleControllerHeartbeat(data) {
    this.notifyListeners('controller-heartbeat', data);
  }
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Create singleton instance
const socketManager = new DroneSocketManager();

export default socketManager;