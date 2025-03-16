import { VOICE_RANGES } from './voiceTypes';

class FrequencyStreamClient {
    constructor(serverUrl = 'ws://localhost:8080') {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.frequencies = [];
        this.audioContext = null;
        this.oscillators = new Map();
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.voiceStates = {};
        this.serverTimeOffset = 0;
        this.pingInterval = null; // Initialize ping interval
        
        // Use a consistent instance ID from localStorage
        this.instanceId = localStorage.getItem('droneChoirInstanceId');
        if (!this.instanceId) {
            this.instanceId = Math.random().toString(36).substring(2, 9);
            localStorage.setItem('droneChoirInstanceId', this.instanceId);
        }
        console.log(`FrequencyStreamClient initialized with ID: ${this.instanceId}`);

        this.frequencies = Object.values(VOICE_RANGES).map(voice => ({
          id: voice.id,
          hertz: voice.hertz,
          voiceType: voice.label.split(' ')[0].toLowerCase(),
          note: voice.note
        }));
        
        // Bind event handlers
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleError = this.handleError.bind(this);

        this.listeners = {
            connect: [],
            disconnect: [],
            error: [],
            streamStart: [],
            streamStop: [],
            voiceStateUpdate: [],
            notesUpdate: [],
            masterChanged: []
        };
    }

    scheduleForcedReconnection() {
      // Force reconnection every 2 minutes to keep connection fresh
      this.forcedReconnectTimer = setTimeout(() => {
        console.log("Performing scheduled reconnection to maintain fresh connection");
        if (this.socket) {
          // Store master status and save before reconnecting
          const wasMaster = this.instanceId === this.masterInstanceId;
          
          // Perform a clean disconnect and reconnect
          this.socket.close();
          setTimeout(() => this.connect(), 500);
        }
      }, 120000); // 2 minutes
    }

    // Set up ping/pong to keep connection alive
    setupPingInterval() {
        // Clear any existing interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // Set up a new interval to ping every 20 seconds
        this.pingInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log("Sending ping to keep connection alive");
                this.socket.send(JSON.stringify({
                    type: 'PING',
                    instanceId: this.instanceId,
                    timestamp: Date.now()
                }));
            }
        }, 20000);
    }

    on(eventName, callback) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].push(callback);
            return this;  // Allow method chaining
        }
        console.warn(`Unsupported event: ${eventName}`);
        return this;
    }

    emit(eventName, ...args) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in ${eventName} event handler:`, error);
                }
            });
        }
    }

    // Initialize WebSocket connection
    connect() {
        // Ensure previous connection is closed
        if (this.socket) {
            this.socket.close();
        }

        // Create new WebSocket connection
        this.socket = new WebSocket(this.serverUrl);
        
        // Set up event listeners
        this.socket.addEventListener('open', this.handleOpen);
        this.socket.addEventListener('message', this.handleMessage);
        this.socket.addEventListener('close', this.handleClose);
        this.socket.addEventListener('error', this.handleError);
    }

    // WebSocket connection opened
    handleOpen(event) {
        console.log(`Connected to frequency streaming server with ID: ${this.instanceId}`);
        this.isConnected = true;
        this.connectionAttempts = 0;

        this.scheduleForcedReconnection();

        // In disconnect:
        if (this.forcedReconnectTimer) {
          clearTimeout(this.forcedReconnectTimer);
          this.forcedReconnectTimer = null;
        }
        
        // Send registration message with instance ID
        this.socket.send(JSON.stringify({
            type: 'REGISTER_CLIENT',
            instanceId: this.instanceId
        }));
        
        // Start ping interval to keep connection alive
        this.setupPingInterval();
        
        this.emit('connect', event);
        this.requestFrequencies();
    }

    // Handle incoming WebSocket messages
    handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        
        // Process timing info if available
        if (data.timing) {
          // Calculate the difference between server time and client time
          // This helps adjust for clock differences between server and client
          const clientReceiveTime = Date.now();
          const serverSendTime = data.timing.serverTime;
          const estimatedLatency = data.timing.timeOffset || 0;
          
          // Calculate time difference between server and client
          const timeDiff = serverSendTime - clientReceiveTime + estimatedLatency;
          
          // Update our offset with some smoothing
          this.serverTimeOffset = this.serverTimeOffset * 0.8 + timeDiff * 0.2;
          
          // console.log(`Server-client time offset: ${this.serverTimeOffset.toFixed(0)}ms`);
        }
        
        switch(data.type) {
          case 'FREQUENCY_CONFIG':
          case 'FREQUENCY_LIST':
            this.frequencies = data.frequencies;
            console.log('Received frequency configuration:', this.frequencies);
            break;
          case 'STREAM_STARTED':
            this.startLocalFrequencyPlayback(data.frequency);
            break;
          case 'STREAM_STOPPED':
            this.stopLocalFrequencyPlayback(data.frequencyId);
            break;
          case 'NOTES_UPDATE':
            // console.log(`Received notes update for ${data.voiceType}:`, data.notes);
            
            // Add scheduled playback time to notes if needed
            if (data.notes && data.notes.length > 0) {
              data.notes = data.notes.map(note => {
                if (note.scheduledStartTime) {
                  // Adjust the scheduled time based on our calculated offset
                  note.scheduledStartTime += this.serverTimeOffset;
                }
                return note;
              });
            }
            
            this.emit('notesUpdate', data.voiceType, data.notes);
            break;
          case 'VOICE_STATE_UPDATE':
            console.log(`Received voice state update for ${data.voiceType}:`, data.state);
            this.voiceStates[data.voiceType] = data.state;
            this.emit('voiceStateUpdate', data.voiceType, data.state);
            break;
          case 'MASTER_CHANGED':
            console.log(`Master changed to: ${data.newMasterId}`);
            
            // Check if we are the new master
            const isMaster = data.newMasterId === this.instanceId;
            
            // Notify listeners
            this.emit('masterChanged', isMaster);
            break;

            case 'PONG':
              const roundTripTime = Date.now() - data.timestamp;
              console.log(`Received pong, round-trip time: ${roundTripTime}ms`);
              break;
          case 'ERROR':
            console.error('Streaming error:', data.message);
            break;
          default:
            console.warn('Unhandled message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }

    // WebSocket connection closed
    handleClose(event) {
        this.isConnected = false;
        
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        this.emit('disconnect', event);
        console.log('Disconnected from frequency streaming server');
        
        // Don't attempt reconnection if another connection for this client is taking over
        if (event.wasClean) {
            console.log('Clean disconnect, no automatic reconnection');
            return;
        }
        
        // Attempt reconnection with exponential backoff
        if (this.connectionAttempts < this.maxConnectionAttempts) {
            const delay = Math.pow(2, this.connectionAttempts) * 1000;
            this.connectionAttempts++;
            
            console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error('Max connection attempts reached. Please check your server.');
        }
    }

    // WebSocket error handling
    handleError(error) {
        console.error('WebSocket error:', error);
        this.emit('error', error);
    }

    // Request available frequencies from the server
    requestFrequencies() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'REQUEST_FREQUENCIES',
                instanceId: this.instanceId
            }));
        }
    }

    // Start streaming a specific frequency
    startFrequencyStream(frequencyId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'START_STREAM',
                frequencyId,
                instanceId: this.instanceId
            }));
        }
    }

    // Stop streaming a specific frequency
    stopFrequencyStream(frequencyId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'STOP_STREAM',
                frequencyId,
                instanceId: this.instanceId
            }));
        }
    }

    // Update notes for a specific voice
    updateNotes(voiceType, notes) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'UPDATE_NOTES',
                voiceType,
                notes,
                instanceId: this.instanceId
            }));
        }
    }

    // Get the current state for a voice type
    getVoiceState(voiceType) {
        return this.voiceStates[voiceType] || null;
    }

    // to check if this client is the master
    checkMasterStatus() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        fetch(`${this.serverUrl.replace('ws:', 'http:')}/api/master/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId: this.instanceId })
        })
        .then(response => response.json())
        .then(data => {
          console.log(`Master status check: ${data.isMaster ? 'MASTER' : 'SLAVE'}`);
          // Ensure we emit this event with the latest status
          this.emit('masterChanged', data.isMaster);
        })
        .catch(error => {
          console.error('Error checking master status:', error);
        });
      }
    }

    // Local frequency playback methods
    startLocalFrequencyPlayback(frequencyData) {
        // Ensure we have an audio context
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Stop any existing oscillator for this frequency
        this.stopLocalFrequencyPlayback(frequencyData.id);

        // Create new oscillator
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequencyData.hertz, this.audioContext.currentTime);

        // Apply fade in and out
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.5);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Start and stop oscillator with fade
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 1);

        // Store oscillator references
        this.oscillators.set(frequencyData.id, {
            oscillator,
            gainNode
        });

        console.log(`Started local playback of ${frequencyData.hertz} Hz (${frequencyData.voiceType})`);
    }

    // Stop local frequency playback
    stopLocalFrequencyPlayback(frequencyId) {
        const oscData = this.oscillators.get(frequencyId);
        
        if (oscData) {
            try {
                const { oscillator, gainNode } = oscData;
                const currentTime = this.audioContext.currentTime;
                
                // Immediate stop and disconnect
                gainNode.gain.cancelScheduledValues(currentTime);
                gainNode.gain.setValueAtTime(0, currentTime);
                
                oscillator.stop(currentTime);
                oscillator.disconnect();
                gainNode.disconnect();
                
                // Remove from oscillators map
                this.oscillators.delete(frequencyId);
                
                console.log(`Stopped local playback of frequency ${frequencyId}`);
            } catch (error) {
                console.error('Error stopping frequency:', error);
            }
        }
    }

    // Cleanup method
    disconnect() {
      // Release master role if disconnecting
      fetch(`${this.serverUrl.replace('ws:', 'http:')}/api/master/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: this.instanceId })
      }).catch(error => {
        console.error('Error releasing master role:', error);
      });
      
        // Stop all local oscillators
        this.oscillators.forEach((oscData, frequencyId) => {
            this.stopLocalFrequencyPlayback(frequencyId);
        });

        // Close WebSocket connection
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Using proper ES Modules export syntax
export default FrequencyStreamClient;