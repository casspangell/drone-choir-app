import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import { VOICE_RANGES } from './voiceTypes';
import socketManager from './DroneSocketManager';

const DroneChoirPerformer = () => {
  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  const [singleVoiceMode, setSingleVoiceMode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState(null); // 'controller' or 'viewer'
  
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
  
  // Connect to socket server and set up listeners
  useEffect(() => {
    // Connect to the socket server
    socketManager.connect();
    
    // Set up socket event listeners
    socketManager.on('connect', () => {
      setIsConnected(true);
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
      // Update global state
      setIsAllPlaying(state.isPlaying);
      setSoloVoice(state.soloVoice);
      
      // Update individual voice modules
      Object.entries(state.voices || {}).forEach(([voiceType, voiceState]) => {
        // Skip if we're in single voice mode and this isn't our voice
        if (singleVoiceMode && voiceType !== singleVoiceMode) return;
        
        // Even if global state is "stopped", process individual voice states
        // This ensures we respect the actual state of each voice
        applyVoiceState(voiceType, voiceState);
      });
    }
  };
  
  // Apply state for a specific voice
  const applyVoiceState = (voiceType, voiceState) => {
    const voiceRef = voiceModuleRefs[voiceType]?.current;
    if (!voiceRef) return;
    
    try {
      // Apply received state to the voice module
      if (voiceState.isPlaying && !voiceRef.isPlaying) {
        // Only start if it's not already playing
        if (voiceState.currentNote) {
          voiceRef.clearQueue();
          voiceRef.addSpecificNote(voiceState.currentNote);
          voiceRef.startPerformance();
        }
      } else if (!voiceState.isPlaying && voiceRef.isPlaying) {
        // Stop if it's playing but shouldn't be
        voiceRef.stopPerformance();
      }
      
      // For viewers, disable auto-generation
      if (viewMode === 'viewer' && voiceRef.autoGenerate) {
        voiceRef.stopAutoGeneration();
      }
    } catch (error) {
      console.error(`Error applying voice state for ${voiceType}:`, error);
    }
  };
  
  const broadcastState = () => {
    if (viewMode !== 'controller') return;
    
    // Gather state from all voice modules
    const voices = {};
    let anyVoicePlaying = false;  // Add this line
    
    Object.entries(voiceModuleRefs).forEach(([voiceType, ref]) => {
      if (!ref.current) return;
      
      const isVoicePlaying = ref.current.isPlaying || false;
      const currentNote = ref.current.getCurrentNote?.() || null;
      
      // Track if any voice is playing
      if (isVoicePlaying) {
        anyVoicePlaying = true;
      }
      
      voices[voiceType] = {
        isPlaying: isVoicePlaying,
        currentNote: currentNote,
        nextNote: ref.current.getNextNote?.() || null
      };
      
      console.log(`${voiceType} state for broadcast:`, isVoicePlaying ? 'playing' : 'stopped', currentNote?.note);
    });
    
    // Update global playing state if it doesn't match
    if (anyVoicePlaying !== isAllPlaying) {
      setIsAllPlaying(anyVoicePlaying);
    }
    
    // Create complete state object
    const state = {
      isPlaying: anyVoicePlaying, // Use the detected state instead of isAllPlaying
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

      // ✅ Deselect all voice modules
      Object.values(voiceModuleRefs).forEach(ref => {
        if (ref.current) {
          ref.current.setIsSolo(false);
          ref.current.setIsSelected(false);  // Explicitly unselect
        }
      });

    } else {
      // Select the new voice
      setSoloVoice(voiceType);

      // ✅ Ensure only the selected voice is active
      Object.entries(voiceModuleRefs).forEach(([refVoiceType, ref]) => {
        if (ref.current) {
          const isSelected = refVoiceType === voiceType;
          ref.current.setIsSolo(isSelected);
          ref.current.setIsSelected(isSelected);  // Ensure UI reflects selection
        }
      });
    }
    
    // Broadcast state after change
    setTimeout(broadcastState, 100);
  }, [viewMode]);
  
  // Initialize shared audio context for all voice modules
  const initSharedAudioContext = useCallback(() => {
    return new (window.AudioContext || window.webkitAudioContext)();
  }, []);
  
  // Handle start unison button click
  const handleStartUnison = useCallback(() => {
    if (viewMode !== 'controller') return;
    
    startUnison(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    
    // Broadcast state after change
    setTimeout(broadcastState, 100);
  }, [viewMode]);
  
  // Handle start all button click
  const handleStartAll = useCallback(() => {
    if (viewMode !== 'controller') return;
    
    startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    
    // Broadcast state after change
    setTimeout(broadcastState, 100);
  }, [viewMode]);
  
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
  if (singleVoiceMode && VOICE_RANGES[singleVoiceMode]) {
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
      {/* Master controls */}
      <div className="master-controls">
        <button 
          className="master-control-button initial" 
          onClick={handleStartUnison}
          disabled={isAllPlaying || viewMode !== 'controller'}
        >
          Start on A Note (10s)
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
      </div>
      
      {/* Voice modules grid */}
      <div className="voice-modules-grid">
        {Object.entries(VOICE_RANGES).map(([voiceType, range]) => (
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
            onSoloToggle={handleVoiceSelection}
            isSoloMode={soloVoice !== null}
            isCurrentSolo={soloVoice === voiceType}
            isViewerMode={viewMode === 'viewer'}
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;