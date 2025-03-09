// performance.js - Contains all performance-related functionality for the Drone Choir system

// Helper function to get note name from frequency
const getNoteName = (frequency) => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440.0;
  const A4Index = 9; // Index of A in noteNames
  
  // Calculate how many half steps away from A4
  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
  
  // Calculate octave and note
  const octave = Math.floor((halfStepsFromA4 + A4Index) / 12) + 4;
  const noteIndex = (((halfStepsFromA4 + A4Index) % 12) + 12) % 12;
  
  return noteNames[noteIndex] + octave;
};

// Start all voice modules on the same pitch for 10 seconds
const startUnison = (voiceRanges, voiceModuleRefs, initSharedAudioContext, setIsAllPlaying) => {
  // Find the overlapping range for all voice types
  const maxMinFreq = Math.max(
    voiceRanges.soprano.min,
    voiceRanges.alto.min,
    voiceRanges.tenor.min,
    voiceRanges.bass.min
  );
  
  const minMaxFreq = Math.min(
    voiceRanges.soprano.max,
    voiceRanges.alto.max,
    voiceRanges.tenor.max,
    voiceRanges.bass.max
  );
  
  // Check if there's an overlapping range at all
  if (maxMinFreq > minMaxFreq) {
    console.error("No common range found for all voices");
    return;
  }
  
  // Choose a pitch in the middle of the common range
  const commonPitch = (maxMinFreq + minMaxFreq) / 2;
  const noteName = getNoteName(commonPitch);
  
  console.log(`Starting all voices on common pitch: ${noteName} (${commonPitch.toFixed(2)} Hz)`);
  
  // Initialize the shared audio context
  const ctx = initSharedAudioContext();
  
  // Create the common note for all voice parts
  const commonNote = {
    frequency: commonPitch,
    duration: 10, // 10 seconds
    note: noteName
  };
  
  // Clear existing queues in all voice modules and add the common note
  Object.values(voiceModuleRefs).forEach(ref => {
    if (ref.current) {
      ref.current.clearQueue();
      ref.current.addSpecificNote(commonNote);
    }
  });
  
  // Start all modules with the shared context
  Object.values(voiceModuleRefs).forEach(ref => {
    if (ref.current && ref.current.startPerformance) {
      ref.current.startPerformance(ctx);
    }
  });
  
  setIsAllPlaying(true);
};

// Start all voice modules with random pitches within their ranges
const startAll = (voiceModuleRefs, initSharedAudioContext, setIsAllPlaying) => {
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

// Stop all voice modules
const stopAll = (voiceModuleRefs, setIsAllPlaying) => {
  Object.values(voiceModuleRefs).forEach(ref => {
    if (ref.current && ref.current.stopPerformance) {
      ref.current.stopPerformance();
    }
  });
  
  setIsAllPlaying(false);
};

// Generate a random note within a specific voice range
const generateRandomNote = (voiceRange, minDuration = 3, maxDuration = 8) => {
  const frequency = Math.random() * (voiceRange.max - voiceRange.min) + voiceRange.min;
  const duration = Math.random() * (maxDuration - minDuration) + minDuration;
  const note = getNoteName(frequency);
  
  return {
    frequency,
    duration,
    note
  };
};

// Export all functions
export {
  startUnison,
  startAll,
  stopAll,
  generateRandomNote,
  getNoteName
};