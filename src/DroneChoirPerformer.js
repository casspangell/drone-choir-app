import React, { useState, useRef, useCallback } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import { VOICE_RANGES } from './voiceTypes';
import useFrequencyStreaming from './useFrequencyStreaming';

const DroneChoirPerformer = () => {
  // Use the streaming hook
  const {
    isConnected,
    error,
    startFrequencyStream,
    stopAllStreams
  } = useFrequencyStreaming();

  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  const [isSolo, setIsSolo] = useState(false);
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };
  
  // Create a shared audio context
  const [sharedAudioContext, setSharedAudioContext] = useState(null);
  
  // Initialize shared audio context on first interaction
  const initSharedAudioContext = useCallback(() => {
    if (!sharedAudioContext) {
      const newContext = new (window.AudioContext || window.webkitAudioContext)();
      setSharedAudioContext(newContext);
      return newContext;
    }
    return sharedAudioContext;
  }, [sharedAudioContext]);

  const handleVoiceSelection = (voiceType) => {
    if (soloVoice === voiceType) {
      // Deselect if the same voice is clicked again
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
  };

  
  // Handle solo toggle
  // const handleSoloToggle = useCallback((voiceType, isSolo) => {
  //   if (isSolo) {
  //     console.log("Soloing voice ", voiceType);
  //     setSoloVoice(voiceType);
  //   } else {
  //     // If turning off solo, clear the solo voice
  //     setSoloVoice(null);
  //   }
  // }, []);
  
  // Handle the master control button click
  const handleMasterControlClick = useCallback(() => {
    if (isAllPlaying) {
      // Stop all streaming frequencies
      stopAllStreams();
      // Stop all voice modules
      stopAll(voiceModuleRefs, setIsAllPlaying);
    } else {
      // Start streaming for each voice type
      Object.values(VOICE_RANGES).forEach(voiceConfig => {
        startFrequencyStream(voiceConfig.id);
      });
      
      // Start all voice modules
      startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    }
  }, [isAllPlaying, startFrequencyStream, stopAllStreams, initSharedAudioContext, voiceModuleRefs]);
  
  // Handle unison start button click
  const handleUnisonStart = useCallback(() => {
    // Common pitch for unison
    const commonPitch = 220; // A3
    const noteName = 'A3';
    
    // Call the unison API endpoint
    fetch('http://localhost:8080/api/unison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pitch: commonPitch,
        note: noteName,
        duration: 10
      })
    }).catch(error => console.error('Error setting unison:', error));
    
    // Continue with existing logic
    Object.values(VOICE_RANGES).forEach(voiceConfig => {
      startFrequencyStream(voiceConfig.id);
    });
    
    startUnison(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
  }, [startFrequencyStream, initSharedAudioContext, voiceModuleRefs]);

  return (
    <div className="drone-choir-multi">
      {/* Connection status and error handling */}
      {error && (
        <div className="connection-error">
          <p>Streaming Error: {error.message || 'Connection failed'}</p>
        </div>
      )}

      {/* Streaming connection status */}
      <div className="connection-status">
        <span 
          className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? 'Streaming: Connected' : 'Streaming: Disconnected'}
        </span>
      </div>

      {/* Master controls */}
      <div className="master-controls">
        <button
          onClick={handleUnisonStart}
          className="master-control-button initial"
          disabled={!isConnected}
        >
          Start All on Same Pitch (10s)
        </button>
        <button
          onClick={handleMasterControlClick}
          className={`master-control-button ${isAllPlaying ? 'stop' : 'start'}`}
          disabled={!isConnected}
        >
          {isAllPlaying ? 'Stop All Voices' : 'Start All Voices'}
        </button>
      </div>
      
      {/* Voice modules grid */}
      <div className="voice-modules-grid">
        {Object.entries(VOICE_RANGES).map(([voiceType, range]) => (
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
            isSelected={soloVoice === voiceType}
            ref={voiceModuleRefs[voiceType]}
            sharedAudioContext={sharedAudioContext}
            onPlayStateChange={(isPlaying) => {
              // Check if any module is still playing when one stops
              if (!isPlaying) {
                const anyStillPlaying = Object.values(voiceModuleRefs).some(
                  ref => ref.current && ref.current.isPlaying
                );
                
                if (!anyStillPlaying) {
                  setIsAllPlaying(false);
                }
              }
            }}
            onSoloToggle={handleVoiceSelection}
            isSoloMode={soloVoice !== null}
            isCurrentSolo={soloVoice === voiceType}
            soloVoice={soloVoice}
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;