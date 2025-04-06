import io from 'socket.io-client';

class AudioPlayer {
  constructor(apiUrl = 'http://localhost:3000') {
    this.socket = io(apiUrl);
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.volume = 0.7; // Default volume
    
    this.setupSocketListeners();
    this.setupAudioContext();
  }
  
  setupSocketListeners() {
    // Listen for new audio files from the server
    this.socket.on('audio-file-received', (data) => {
      console.log('Audio file received:', data);
      
      // Add the audio file to our queue
      this.audioQueue.push({
        url: data.audioFile.url,
        metadata: data.metadata
      });
      
      // If we're not currently playing anything, start playing
      if (!this.isPlaying) {
        this.playNextInQueue();
      }
    });
    
    // Listen for connection events
    this.socket.on('connect', () => {
      console.log('Connected to API server');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from API server');
    });
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
    
    // Create an audio element
    this.currentAudio = new Audio(audioData.url);
    
    // Set volume (0.0 to 1.0)
    const requestedVolume = audioData.metadata?.playback_volume;
    this.currentAudio.volume = requestedVolume || this.volume;
    
    // Set up event handlers
    this.currentAudio.onended = () => {
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    this.currentAudio.onerror = (e) => {
      console.error('Error playing audio:', e);
      this.currentAudio = null;
      this.playNextInQueue();
    };
    
    // Start playback
    this.currentAudio.play()
      .then(() => {
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