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
    handleOpen() {
        console.log('Connected to frequency streaming server');
        this.isConnected = true;
        this.connectionAttempts = 0;
        
        // Request initial frequency list
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
                case 'ERROR':
                    console.error('Streaming error:', data.message);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    // WebSocket connection closed
    handleClose(event) {
        this.isConnected = false;
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

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Start oscillator
        oscillator.start();

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
                // Fade out and stop
                const { oscillator, gainNode } = oscData;
                const currentTime = this.audioContext.currentTime;
                
                gainNode.gain.cancelScheduledValues(currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
                gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.5);
                
                // Actually stop after fade out
                setTimeout(() => {
                    oscillator.stop();
                    oscillator.disconnect();
                    gainNode.disconnect();
                }, 500);
                
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