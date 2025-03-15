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
            notesUpdate: []
        };
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
        console.log('Connected to frequency streaming server');
        this.isConnected = true;
        this.connectionAttempts = 0;
        
        this.emit('connect', event);
        this.requestFrequencies();
    }

    // Handle incoming WebSocket messages
    handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        
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
            console.log(`Received notes update for ${data.voiceType}:`, data.notes);
            this.emit('notesUpdate', data.voiceType, data.notes);
            break;
          case 'VOICE_STATE_UPDATE':
            console.log(`Received voice state update for ${data.voiceType}:`, data.state);
            this.voiceStates[data.voiceType] = data.state;
            this.emit('voiceStateUpdate', data.voiceType, data.state);
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
        this.emit('disconnect', event);
        console.log('Disconnected from frequency streaming server');
        
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
                type: 'REQUEST_FREQUENCIES'
            }));
        }
    }

    // Start streaming a specific frequency
    startFrequencyStream(frequencyId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'START_STREAM',
                frequencyId
            }));
        }
    }

    // Stop streaming a specific frequency
    stopFrequencyStream(frequencyId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'STOP_STREAM',
                frequencyId
            }));
        }
    }

    // Update notes for a specific voice
    updateNotes(voiceType, notes) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'UPDATE_NOTES',
                voiceType,
                notes
            }));
        }
    }

    // Get the current state for a voice type
    getVoiceState(voiceType) {
        return this.voiceStates[voiceType] || null;
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

export default FrequencyStreamClient;