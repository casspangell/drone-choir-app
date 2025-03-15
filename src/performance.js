// Contains all performance-related functionality for the Drone Choir system

import { getNoteName } from './voiceTypes';

// Start all voice modules on the same pitch for 10 seconds
const startUnison = (voiceModuleRefs, initSharedAudioContext, setIsAllPlaying) => {
  const commonPitch = 220; // A3
  const noteName = getNoteName(commonPitch);
  
  console.log(`Starting all voices on fixed pitch: ${noteName} (${commonPitch.toFixed(2)} Hz)`);
  
  // Initialize the shared audio context
  const ctx = initSharedAudioContext();
  
  // Create the common note for all voice parts
  const commonNote = {
    frequency: commonPitch,
    duration: 10, // 10 seconds
    note: noteName
  };
  
  // Clear existing queues in all voice modules and add the common note
  Object.entries(voiceModuleRefs).forEach(([voiceType, ref]) => {
    if (ref.current) {
      // First clear the queue
      ref.current.clearQueue();
      // Then add the common note
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

// Export all functions
export {
  startUnison,
  startAll,
  stopAll
};