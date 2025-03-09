import React from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';

const DroneChoirPerformer = () => {
  // Define voice ranges for the different voice types
  const voiceRanges = {
    soprano: { min: 261.63, max: 880.00, label: 'Soprano (C4-A5)' },
    alto: { min: 174.61, max: 587.33, label: 'Alto (F3-D5)' },
    tenor: { min: 130.81, max: 440.00, label: 'Tenor (C3-A4)' },
    bass: { min: 87.31, max: 329.63, label: 'Bass (F2-E4)' }
  };

  return (
    <div className="drone-choir-multi">
      <div className="voice-modules-grid">
        {Object.entries(voiceRanges).map(([voiceType, range]) => (
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;