import React, { useState, useRef, useCallback } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import { VOICE_RANGES } from './voiceTypes';
import { useEffect } from 'react';

const DroneChoirPerformer = () => {

  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  const [singleVoiceMode, setSingleVoiceMode] = useState(null);
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };

  const voiceRangeMapping = {
    'high': 'soprano',
    'mid-high': 'alto',
    'low-mid': 'tenor',
    'low': 'bass'
  };

  const getRangeLabel = (voiceType) => {
    return Object.entries(voiceRangeMapping).find(
      ([_, value]) => value === voiceType
    )?.[0]?.toUpperCase() || 'VOICE';
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

    if (singleVoiceMode && VOICE_RANGES[singleVoiceMode]) {
    console.log('Rendering single voice mode for:', singleVoiceMode);
    const voiceType = singleVoiceMode;
    const range = VOICE_RANGES[voiceType];
    
    return (
      <div className="drone-choir-single">
        <h1>
          {Object.entries(voiceRangeMapping).find(([_, value]) => value === voiceType)?.[0]?.toUpperCase() || 'VOICE'} VOICE 
        </h1>
        <div className="single-voice-container">
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
            rangeLabel={getRangeLabel(voiceType)} 
            ref={voiceModuleRefs[voiceType]}
            onPlayStateChange={(isPlaying) => {
              // Check if any module is still playing when one stops
              if (!isPlaying) {
                setIsAllPlaying(false);
              }
            }}
            onSoloToggle={handleSoloToggle}
            isSoloMode={false}
            isCurrentSolo={false}
            isSingleMode={true}
          />
        </div>
      </div>
    );
  }

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
            rangeLabel={getRangeLabel(voiceType)}
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