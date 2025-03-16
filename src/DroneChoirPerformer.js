import React, { useState, useRef, useCallback } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import { VOICE_RANGES } from './voiceTypes';

const DroneChoirPerformer = () => {

  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };
  
  const handleSoloToggle = useCallback((voiceType, isSolo) => {
    console.log('Solo toggle called:', { voiceType, isSolo });
    
    if (isSolo) {
      setSoloVoice(voiceType);
      
    } else {
      setSoloVoice(null);
    }
  }, []);
  
  // Initialize shared audio context for all voice modules
  const initSharedAudioContext = () => {
    return new (window.AudioContext || window.webkitAudioContext)();
  };
  
  // Handle start unison button click
  const handleStartUnison = () => {
    startUnison(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
  };
  
  // Handle start all button click
  const handleStartAll = () => {
    startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
  };
  
  // Handle stop all button click
  const handleStopAll = () => {
    stopAll(voiceModuleRefs, setIsAllPlaying);
  };

  return (
    <div className="drone-choir-multi">
      {/* Master controls */}
      <div className="master-controls">
        <button 
          className="master-control-button initial" 
          onClick={handleStartUnison}
          disabled={isAllPlaying}
        >
          Start on A Note (10s)
        </button>
        <button 
          className="master-control-button start" 
          onClick={handleStartAll}
          disabled={isAllPlaying}
        >
          Start All Voices
        </button>
        <button 
          className="master-control-button stop" 
          onClick={handleStopAll}
          disabled={!isAllPlaying}
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
            ref={voiceModuleRefs[voiceType]}
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
            onSoloToggle={handleSoloToggle}
            isSoloMode={soloVoice !== null}
            isCurrentSolo={soloVoice === voiceType}
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;