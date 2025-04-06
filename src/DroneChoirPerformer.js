import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import socketManager from './DroneSocketManager';
import { VOICE_RANGES, generateRandomNote } from './voiceTypes';
import { io } from 'socket.io-client';

const DroneChoirPerformer = () => {
  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  const [singleVoiceMode, setSingleVoiceMode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState(null); // 'controller' or 'viewer'
  const [dashboardMuted, setDashboardMuted] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const sharedAudioContextRef = useRef(null);
  const [lastInputReceived, setLastInputReceived] = useState(null);

  const apiSocket = io('http://localhost:3000'); 
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };
  
  // Mapping for URL parameters to voice types
  const voiceRangeMapping = {
    'high': 'soprano',
    'mid-high': 'alto',
    'low-mid': 'tenor',
    'low': 'bass'
  };

  const initializeAudio = useCallback(() => {
    if (audioInitialized) return;
    
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume the audio context
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('AudioContext successfully resumed');
          sharedAudioContextRef.current = audioContext;
          setAudioInitialized(true);
          
          // Apply to all voice modules
          Object.values(voiceModuleRefs).forEach(ref => {
            if (ref.current && ref.current.setAudioContext) {
              ref.current.setAudioContext(audioContext);
            }
          });
          
          // Add class to container to indicate audio is enabled
          document.body.classList.add('audio-enabled');
        });
      } else {
        sharedAudioContextRef.current = audioContext;
        setAudioInitialized(true);
        document.body.classList.add('audio-enabled');
        
        // Apply to all voice modules
        Object.values(voiceModuleRefs).forEach(ref => {
          if (ref.current && ref.current.setAudioContext) {
            ref.current.setAudioContext(audioContext);
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }, [audioInitialized]);

  const toggleDashboardMute = useCallback(() => {
    const newMuteState = !dashboardMuted;
    setDashboardMuted(newMuteState);
    
    // Apply to all voice modules
    Object.values(voiceModuleRefs).forEach(ref => {
      if (ref.current) {
        ref.current.setDashboardMute(newMuteState);
      }
    });
    
    console.log(`Dashboard ${newMuteState ? 'muted' : 'unmuted'}`);
  }, [dashboardMuted]);

  
  // Effect for checking URL query parameters and detecting single voice mode
  useEffect(() => {
    // Check URL for voice range parameter
    const queryParams = new URLSearchParams(window.location.search);
    const rangeParams = Object.keys(voiceRangeMapping);
    
    console.log('URL search params:', window.location.search);
    console.log('Parsed query params:', Object.fromEntries(queryParams));
    
    // Check for any range parameter in the URL
    for (const rangeParam of rangeParams) {
      if (queryParams.has(rangeParam)) {
        const voiceType = voiceRangeMapping[rangeParam];
        console.log(`Single voice mode detected: ${rangeParam} -> ${voiceType}`);
        setSingleVoiceMode(voiceType);
        break;
      }
    }
    
    console.log('Range params checked:', rangeParams);
  }, []);

  useEffect(() => {
    // Connect to the API socket for input notifications
    apiSocket.on('connect', () => {
      console.log('Connected to API server for notifications');
    });
    
    apiSocket.on('api-input-received', (data) => {
      console.log('API input received:', data);
      setLastInputReceived(new Date());
      
      // Auto-clear the notification after 3 seconds
      setTimeout(() => {
        setLastInputReceived(null);
      }, 3000);
    });
    
    return () => {
      apiSocket.disconnect();
    };
  }, []);

  
  // Connect to socket server and set up listeners
  useEffect(() => {
    // Connect to the socket server
    socketManager.connect();
    
    // Set up socket event listeners
    socketManager.on('connect', () => {
      setIsConnected(true);

      // Disable auto-generation for all voice modules as soon as connected
      Object.values(voiceModuleRefs).forEach(ref => {
        if (ref.current && ref.current.stopAutoGeneration) {
          console.log("Disabling auto-generation in voice module");
          ref.current.stopAutoGeneration();
        }
      });
    });
    
    socketManager.on('disconnect', () => {
      setIsConnected(false);
    });
    
    socketManager.on('registered', (data) => {
      setViewMode(data.type);
    });
    
    socketManager.on('initial-state', (state) => {
      // Apply initial state from server
      applyReceivedState(state);
    });
    
    socketManager.on('state-updated', (state) => {
      // Apply state updates from server
      applyReceivedState(state);
    });
    
    socketManager.on('voice-state', (data) => {
      // Apply state for a specific voice
      applyVoiceState(data.voiceType, data.state);
    });

    socketManager.on('api-input-received', (data) => {
      console.log('API input received:', data);
      setLastInputReceived(new Date());
      
      // Auto-clear the notification after 3 seconds
      setTimeout(() => {
        setLastInputReceived(null);
      }, 3000);
    });
    
    // Clean up on unmount
    return () => {
      socketManager.disconnect();
    };
  }, []);
  
  // Register as controller or viewer when connected
  useEffect(() => {
    if (!isConnected) return;
    
    if (singleVoiceMode) {
      // Register as a viewer for a specific voice
      socketManager.register('viewer', singleVoiceMode);
    } else {
      // Register as the main controller
      socketManager.register('controller');
    }
  }, [isConnected, singleVoiceMode]);
  
  // Broadcast state updates to server (from controller)
  useEffect(() => {
    if (viewMode !== 'controller') return;
    
    // Set up periodic state broadcasting
    const broadcastInterval = setInterval(() => {
      broadcastState();
    }, 1000);
    
    return () => {
      clearInterval(broadcastInterval);
    };
  }, [viewMode]);
  
  const applyReceivedState = (state) => {
    if (!state) return;
    
    if (viewMode === 'viewer') {
      console.log('Applying received state as viewer, single voice mode:', singleVoiceMode);
      
      // Update global state
      setIsAllPlaying(state.isPlaying);
      setSoloVoice(state.soloVoice);
      
      // Update individual voice modules
      Object.entries(state.voices || {}).forEach(([voiceType, voiceState]) => {
        console.log(`Processing voice state for ${voiceType}:`, 
                    voiceState.isPlaying ? 'playing' : 'stopped', 
                    voiceState.currentNote?.note);
        
        // Skip if we're in single voice mode and this isn't our voice
        if (singleVoiceMode && voiceType !== singleVoiceMode) {
          console.log(`Skipping ${voiceType} as we're in ${singleVoiceMode} mode`);
          return;
        }
        
        console.log(`Applying state for ${voiceType} in single voice mode:`, singleVoiceMode);
        
        // Apply the voice state
        applyVoiceState(voiceType, voiceState);
      });
    }
  };
  
// Update the applyVoiceState function to handle queue updates properly

const applyVoiceState = (voiceType, voiceState) => {
  console.log(`Applying voice state for ${voiceType}:`, 
              voiceState.isPlaying ? 'playing' : 'stopped',
              voiceState.currentNote?.note);
  
  const voiceRef = voiceModuleRefs[voiceType]?.current;
  if (!voiceRef) {
    console.error(`No ref for ${voiceType}`);
    return;
  }
  
  try {
    // Always log the full received state for debugging
    console.log('Full received voice state:', JSON.stringify(voiceState, null, 2));
    
    // Handle play messages
    if (voiceState.isPlaying && voiceState.currentNote) {
      if (!voiceRef.isPlaying) {
        console.log(`Starting ${voiceType} with note:`, voiceState.currentNote.note);
        voiceRef.clearQueue();
        voiceRef.addSpecificNote(voiceState.currentNote);
        
        // If there's a next note, add it to the queue
        if (voiceState.nextNote) {
          voiceRef.addSpecificNoteToQueue(voiceState.nextNote);
        }
        
        voiceRef.startPerformance();
      } else {
        // If already playing, check if we need to update the current note
        const currentNote = voiceRef.getCurrentNote?.();
        
        // If the current note from server is different from what's playing,
        // update to the new note (this helps when moving to the next note)
        if (currentNote?.note !== voiceState.currentNote.note) {
          console.log(`Updating ${voiceType} current note to:`, voiceState.currentNote.note);
          
          // Clear and set the new current note
          voiceRef.clearQueue();
          voiceRef.addSpecificNote(voiceState.currentNote);
          
          // Since we're already playing, this will take effect when the current note ends
        }
        
        // Always update the next note in the queue
        if (voiceState.nextNote) {
          console.log(`Adding next note to ${voiceType} queue:`, voiceState.nextNote.note);
          voiceRef.addSpecificNoteToQueue(voiceState.nextNote);
        }
      }
    }
    // Still ignoring stop messages to break the cycle
    
  } catch (error) {
    console.error(`Error applying voice state for ${voiceType}:`, error);
  }
};
  
const broadcastState = () => {
  if (viewMode !== 'controller') return;
  
  const voices = {};
  let anyVoicePlaying = false;
  
  Object.entries(voiceModuleRefs).forEach(([voiceType, ref]) => {
    if (!ref.current) return;
    
    const isVoicePlaying = ref.current.isPlaying || false;
    const currentNote = ref.current.getCurrentNote?.() || null;
    const nextNote = ref.current.getNextNote?.() || null;
    const queue = ref.current.getFullQueue?.() || [];
    
    // Track if any voice is playing
    if (isVoicePlaying) {
      anyVoicePlaying = true;
    }
    
    // Never use auto-generated notes, only use queued notes
    const includeNextNote = nextNote || (queue.length > 0 ? queue[0] : null);
    
    voices[voiceType] = {
      isPlaying: isVoicePlaying,
      currentNote: currentNote,
      nextNote: includeNextNote,
      queue: queue,
      autoGenerate: false  // Always set to false
    };
    
    console.log(`${voiceType} state for broadcast:`, 
                isVoicePlaying ? 'playing' : 'stopped', 
                currentNote?.note, 
                `nextNote: ${includeNextNote?.note || 'none'}`,
                `queue length: ${queue.length}`);
  });
  
  // Update global playing state if it doesn't match
  if (anyVoicePlaying !== isAllPlaying) {
    setIsAllPlaying(anyVoicePlaying);
  }
  
  // Create complete state object
  const state = {
    isPlaying: anyVoicePlaying,
    soloVoice,
    voices,
    timestamp: Date.now()
  };
  
  console.log("Broadcasting state:", state.isPlaying ? 'playing' : 'stopped', 
              Object.keys(voices).map(v => `${v}: ${voices[v].isPlaying ? 'playing' : 'stopped'}`).join(', '));
  
  // Send to server
  socketManager.updateState(state);
};

  const handleSoloToggle = useCallback((voiceType, isSolo) => {
    if (viewMode !== 'controller') return;
    
    console.log('Solo toggle called:', { voiceType, isSolo });
    
    if (isSolo) {
      setSoloVoice(voiceType);
    } else {
      setSoloVoice(null);
    }
    
    // Broadcast state after change
    setTimeout(broadcastState, 100);
  }, [viewMode]);
  
  // Initialize shared audio context for all voice modules
  const initSharedAudioContext = useCallback(() => {
    // If we already have a shared context, use it
    if (sharedAudioContextRef.current) {
      console.log('Using existing shared audio context');
      
      if (sharedAudioContextRef.current.state === 'suspended') {
        console.log('Resuming shared audio context');
        sharedAudioContextRef.current.resume()
          .then(() => console.log('Shared audio context resumed'))
          .catch(err => console.error('Failed to resume shared audio context:', err));
      }
      
      return sharedAudioContextRef.current;
    }
    
    // Otherwise create a new one
    console.log('Creating new shared audio context');
    const newContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Try to resume it
    if (newContext.state === 'suspended') {
      console.log('Resuming newly created shared audio context');
      newContext.resume()
        .then(() => console.log('Newly created shared audio context resumed'))
        .catch(err => console.error('Failed to resume newly created shared audio context:', err));
    }
    
    // Store it for future use
    sharedAudioContextRef.current = newContext;
    
    return newContext;
  }, []);
  
  // Handle start unison button click
  const handleStartUnison = useCallback(() => {
    if (viewMode !== 'controller') return;
    
    // Check if audio is initialized
    if (!audioInitialized) {
      console.log('Audio not initialized, initializing now');
      initializeAudio();
      
      // Allow time for audio initialization
      setTimeout(() => {
        console.log('Starting unison after audio initialization');
        startUnison(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
        setTimeout(broadcastState, 100);
      }, 500);
      return;
    }
    
    // Audio already initialized, proceed normally
    startUnison(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    setTimeout(broadcastState, 100);
  }, [viewMode, audioInitialized, initializeAudio, initSharedAudioContext]);
  
  // Handle start all button click
  const handleStartAll = useCallback(() => {
    if (viewMode !== 'controller') return;
    
    // Check if audio is initialized
    if (!audioInitialized) {
      console.log('Audio not initialized, initializing now');
      initializeAudio();
      
      // Allow time for audio initialization
      setTimeout(() => {
        console.log('Starting all voices after audio initialization');
        startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
        setTimeout(broadcastState, 100);
      }, 500);
      return;
    }
    
    // Audio already initialized, proceed normally
    startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    setTimeout(broadcastState, 100);
  }, [viewMode, audioInitialized, initializeAudio, initSharedAudioContext]);
  
  // Handle stop all button click
  const handleStopAll = useCallback(() => {
    if (viewMode !== 'controller') return;
    
    stopAll(voiceModuleRefs, setIsAllPlaying);
    
    // Broadcast state after change
    setTimeout(broadcastState, 100);
  }, [viewMode]);
  
  // Helper function to get range label
  const getRangeLabel = (voiceType) => {
    return Object.entries(voiceRangeMapping).find(
      ([_, value]) => value === voiceType
    )?.[0]?.toUpperCase() || 'VOICE';
  };
  
  // If in single voice mode, render only that voice module
  if (VOICE_RANGES[singleVoiceMode]) {
    const voiceType = singleVoiceMode;
    const range = VOICE_RANGES[voiceType];
    const rangeLabel = getRangeLabel(voiceType);
    
    return (
      <div className="drone-choir-single">
        <h1>{rangeLabel} VOICE</h1>
        <div className="single-voice-container">
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
            rangeLabel={rangeLabel}
            ref={voiceModuleRefs[voiceType]}
            onPlayStateChange={(isPlaying) => {
              // Only controller can change play state
              if (viewMode !== 'controller') return;
              
              // Broadcast state after change
              setTimeout(broadcastState, 100);
            }}
            onSoloToggle={handleSoloToggle}
            isSoloMode={false}
            isCurrentSolo={false}
            isViewerMode={viewMode === 'viewer'}
            isSingleMode={true}
          />
        </div>
      </div>
    );
  }
  
  // If not connected yet, show connecting message
  if (!isConnected) {
    return (
      <div className="connecting-message">
        <h2>Connecting to server...</h2>
      </div>
    );
  }

  // Regular full view with all voice modules
  return (
    <div className="drone-choir-multi">
      {lastInputReceived && (
        <div className="input-notification">
          <div className="notification-content">
            <span className="notification-icon">📡</span>
            <span className="notification-text">External input received at {lastInputReceived.toLocaleTimeString()}</span>
          </div>
        </div>
      )}
      {/* Master controls */}
      <div className="master-controls">
        <button 
          className="master-control-button initial" 
          onClick={handleStartUnison}
          disabled={isAllPlaying || viewMode !== 'controller'}
        >
          Start on A Note (20s)
        </button>
        <button 
          className="master-control-button start" 
          onClick={handleStartAll}
          disabled={isAllPlaying || viewMode !== 'controller'}
        >
          Start All Voices
        </button>
        <button 
          className="master-control-button stop" 
          onClick={handleStopAll}
          disabled={!isAllPlaying || viewMode !== 'controller'}
        >
          Stop All Voices
        </button>
        <button 
          className="master-control-button mute"
          onClick={toggleDashboardMute}
          data-muted={dashboardMuted}
        >
          {dashboardMuted ? 'Unmute Dashboard' : 'Mute Dashboard'}
        </button>
      </div>
      
     {/* Voice modules grid */}
      <div className="voice-modules-grid">
        {Object.entries(VOICE_RANGES).map(([voiceType, range]) => (
          <div key={voiceType} className="voice-module-container">
            <h1>{getRangeLabel(voiceType)} VOICE</h1>
            <VoiceModule 
              key={voiceType}
              voiceType={voiceType} 
              voiceRange={range}
              rangeLabel={getRangeLabel(voiceType)}
              ref={voiceModuleRefs[voiceType]}
              onPlayStateChange={(isPlaying) => {
                // Only controller can change play state
                if (viewMode !== 'controller') return;
                
                // Check if any module is still playing when one stops
                if (!isPlaying) {
                  const anyStillPlaying = Object.values(voiceModuleRefs).some(
                    ref => ref.current && ref.current.isPlaying
                  );
                  
                  if (!anyStillPlaying) {
                    setIsAllPlaying(false);
                  }
                }
                
                // Broadcast state after change
                setTimeout(broadcastState, 100);
              }}
              onSoloToggle={handleSoloToggle}
              isSoloMode={soloVoice !== null}
              isCurrentSolo={soloVoice === voiceType}
              isViewerMode={viewMode === 'viewer'}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;