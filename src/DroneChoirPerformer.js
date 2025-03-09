import React, { useState, useRef, useEffect } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';

const DroneChoirPerformer = () => {
  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  // Create a shared audio context
  const [sharedAudioContext, setSharedAudioContext] = useState(null);
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };
  
  // Initialize shared audio context on first interaction
  const initSharedAudioContext = () => {
    if (!sharedAudioContext) {
      const newContext = new (window.AudioContext || window.webkitAudioContext)();
      setSharedAudioContext(newContext);
      return newContext;
    }
    return sharedAudioContext;
  };
  
  // Define voice ranges for the different voice types
  const voiceRanges = {
    soprano: { min: 261.63, max: 880.00, label: 'Soprano (C4-A5)' },
    alto: { min: 174.61, max: 587.33, label: 'Alto (F3-D5)' },
    tenor: { min: 130.81, max: 440.00, label: 'Tenor (C3-A4)' },
    bass: { min: 87.31, max: 329.63, label: 'Bass (F2-E4)' }
  };
  
  // Function to start all modules
  const startAllModules = () => {
    // Initialize the shared audio context first
    const ctx = initSharedAudioContext();
    
    // Then start all modules with the shared context
    Object.values(voiceModuleRefs).forEach(ref => {
      if (ref.current && ref.current.startPerformance) {
        ref.current.startPerformance(ctx);
      }
    });
    
    setIsAllPlaying(true);
  };
  
  // Function to stop all modules
  const stopAllModules = () => {
    Object.values(voiceModuleRefs).forEach(ref => {
      if (ref.current && ref.current.stopPerformance) {
        ref.current.stopPerformance();
      }
    });
    
    setIsAllPlaying(false);
  };
  
  // Handle the master control button click
  const handleMasterControlClick = () => {
    if (isAllPlaying) {
      stopAllModules();
    } else {
      startAllModules();
    }
  };

  return (
    <div className="drone-choir-multi">
      <div className="master-controls">
        <button
          onClick={handleMasterControlClick}
          className={`master-control-button ${isAllPlaying ? 'stop' : 'start'}`}
        >
          {isAllPlaying ? 'Stop All Voices' : 'Start All Voices'}
        </button>
      </div>
      
      <div className="voice-modules-grid">
        {Object.entries(voiceRanges).map(([voiceType, range]) => (
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
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
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;