import io from 'socket.io-client';

class AudioPlayer {
  constructor(apiUrl = 'http://localhost:3000') {
    // Configure Socket.io with explicit CORS settings
    this.socket = io(apiUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      extraHeaders: {
        "Custom-Socket-Header": "DroneChoirAudioPlayer"
      }
    });
    
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.volume = 0.7; // Default volume
    this.apiUrl = apiUrl;
    
    this.setupSocketListeners();
    this.setupAudioContext();
    
    // Add connection logging for debugging
    console.log(`Attempting to connect to ${apiUrl}`);
  }
  
  setupSocketListeners() {
    // Log connection events
    this.socket.on('connect', () => {
      console.log(`Connected to API server at ${this.apiUrl}`);
      console.log(`Socket ID: ${this.socket.id}`);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error(`Connection error to ${this.apiUrl}:`, error);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log(`Disconnected from API server: ${reason}`);
    });
    
    // Listen for new audio files from the server
    this.socket.on('audio-file-received', (data) => {
      console.log('Audio file received:', data);
      
      // Check if we should handle this audio based on targeting
      if (this.shouldHandleAudio(data)) {
        // Add the audio file to our queue
        this.audioQueue.push({
          url: data.audioFile.url,
          metadata: data.metadata
        });
        
        // If we're not currently playing anything, start playing
        if (!this.isPlaying) {
          this.playNextInQueue();
        }
      } else {
        console.log('Ignoring audio file - not targeted for this player');
      }
    });
    
    // Listen for direct play commands
    this.socket.on('play-audio', (data) => {
      console.log('Play audio command received:', data);
      
      // Check if we should handle this audio based on targeting
      if (this.shouldHandleAudio(data)) {
        // Add the audio file to our queue
        this.audioQueue.push({
          url: data.audioFile.url,
          metadata: data.metadata
        });
        
        // If we're not currently playing anything, start playing
        if (!this.isPlaying) {
          this.playNextInQueue();
        }
      } else {
        console.log('Ignoring play command - not targeted for this player');
      }
    });
  }
  
  // Determine if this player should handle the audio based on targeting
  shouldHandleAudio(data) {
    // If there's no target voice or target is 'all', handle it
    if (!data.targetVoice || data.targetVoice === 'all') {
      return true;
    }
    
    // Check URL for voice type parameter
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    
    // Look for voice type in URL
    const isSoprano = searchParams.has('high') || searchParams.has('soprano');
    const isAlto = searchParams.has('mid-high') || searchParams.has('alto');
    const isTenor = searchParams.has('low-mid') || searchParams.has('tenor');
    const isBass = searchParams.has('low') || searchParams.has('bass');
    
    // Determine current voice type
    let currentVoice = 'unknown';
    if (isSoprano) currentVoice = 'soprano';
    else if (isAlto) currentVoice = 'alto';
    else if (isTenor) currentVoice = 'tenor';
    else if (isBass) currentVoice = 'bass';
    
    // If on main dashboard (no voice parameter)
    if (currentVoice === 'unknown' && !isSoprano && !isAlto && !isTenor && !isBass) {
      return true; // Main dashboard receives all audio
    }
    
    // Match current voice with target voice
    return currentVoice === data.targetVoice;
  }
  
  setupAudioContext() {
    // Create an audio context for more advanced control (optional)
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('Web Audio API not supported in this browser');
    }
  }
  
  playNextInQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    const audioData = this.audioQueue.shift();
    
    console.log(`Playing audio URL: ${audioData.url}`);
    
    // Fix cross-origin URLs if needed
    let audioUrl = audioData.url;
    if (audioUrl.startsWith('http://localhost:3000') && window.location.hostname !== 'localhost') {
      // Replace localhost with the actual server IP
      const apiUrlObject = new URL(this.apiUrl);
      audioUrl = audioUrl.replace('http://localhost:3000', `http://${apiUrlObject.hostname}:3000`);
      console.log(`Adjusted URL for cross-origin: ${audioUrl}`);
    }
    
    // Create an audio element
    this.currentAudio = new Audio(audioUrl);
    
    // Set volume (0.0 to 1.0)
    const requestedVolume = audioData.metadata?.playback_volume;
    this.currentAudio.volume = requestedVolume || this.volume;
    
    // Set up event handlers
    this.currentAudio.onended = () => {
      console.log('Audio playback ended');
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    this.currentAudio.onerror = (e) => {
      console.error('Error playing audio:', e);
      console.error('Error details:', this.currentAudio.error);
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    // Start playback
    this.currentAudio.play()
      .then(() => {
        console.log('Audio playback started successfully');
        // Trigger any UI updates or notifications
        this.triggerPlaybackStarted(audioData);
      })
      .catch(err => {
        console.error('Failed to play audio:', err);
        this.currentAudio = null;
        this.playNextInQueue();
      });
  }
  
  triggerPlaybackStarted(audioData) {
    // Dispatch a custom event that other parts of your app can listen for
    const event = new CustomEvent('haiku-playback-started', {
      detail: {
        title: audioData.metadata.title,
        description: audioData.metadata.description,
        timestamp: audioData.metadata.timestamp
      }
    });
    document.dispatchEvent(event);
    
    // You could also update a UI element directly
    const notificationElement = document.getElementById('audio-notification');
    if (notificationElement) {
      notificationElement.textContent = `Now playing: ${audioData.metadata.title}`;
      notificationElement.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        notificationElement.style.display = 'none';
      }, 5000);
    }
  }
  
  setVolume(newVolume) {
    // Ensure volume is between 0 and 1
    this.volume = Math.min(1, Math.max(0, newVolume));
    
    // Update current audio if playing
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
    
    // Update gain node if available
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }
  
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
  }
}

export default AudioPlayer;