import React, { useState, useRef, useEffect } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { VOICE_RANGES } from './voiceTypes';
import { startUnison, startAll, stopAll } from './performance';

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

  const voiceRanges = VOICE_RANGES;

  // Handle the master control button click
  const handleMasterControlClick = () => {
    if (isAllPlaying) {
      stopAll(voiceModuleRefs, setIsAllPlaying);
    } else {
      startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    }
  };
  
  // Handle unison start button click
  const handleUnisonStart = () => {
    startUnison(VOICE_RANGES, voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
  };

  return (
    <div className="drone-choir-multi">
      <div className="master-controls">
        <button
          onClick={handleUnisonStart}
          className="master-control-button initial"
        >
          Start All on Same Pitch (10s)
        </button>
        <button
          onClick={handleMasterControlClick}
          className={`master-control-button ${isAllPlaying ? 'stop' : 'start'}`}
        >
          {isAllPlaying ? 'Stop All Voices' : 'Start All Voices'}
        </button>
      </div>
      
      <div className="voice-modules-grid">
        {Object.entries(VOICE_RANGES).map(([voiceType, range]) => (
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