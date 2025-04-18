// Contains all performance-related functionality for the Drone Choir system

import { VOICE_RANGES, getNoteName } from './voiceTypes';

// Start all voice modules on the A note appropriate for each voice for 10 seconds
const startUnison = (voiceModuleRefs, initSharedAudioContext, setIsAllPlaying) => {
  console.log('Starting all voices on their respective A notes for 10 seconds');
  
  // Initialize the shared audio context
  const ctx = initSharedAudioContext();
  
  // Clear existing queues in all voice modules
  Object.entries(voiceModuleRefs).forEach(([voiceType, ref]) => {
    if (ref.current) {
      // First clear the queue
      ref.current.clearQueue();
      
      // Get the appropriate A note for this voice type from VOICE_RANGES
      const voiceRange = VOICE_RANGES[voiceType];
      
      // Create the note for this voice part
      const voiceNote = {
        frequency: voiceRange.hertz, // Use the predefined A note frequency
        duration: 10, // 10 seconds
        note: voiceRange.note // Use the predefined A note name
      };
      
      // Add the voice-specific A note to the queue
      ref.current.addSpecificNote(voiceNote);
      console.log(`Added ${voiceNote.note} (${voiceNote.frequency} Hz) to ${voiceType}`);
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