// voiceTypes.js
// Centralized configuration for voice types and frequencies

/**
 * Voice range and frequency configuration for different voice types
 */
export const VOICE_RANGES = {
    bass: { 
        min: 98.00, 
        max: 261.63, 
        label: '(G2-C4)', 
        id: 4,
        hertz: 110,
        note: 'A2'
    },
    tenor: { 
        min: 130.81, 
        max: 349.23, 
        label: '(C3-F4)', 
        id: 3,
        hertz: 880,
        note: 'A5'
    },
    alto: { 
        min: 164.81, 
        max: 392.00, 
        label: '(E3-G4)', 
        id: 2,
        hertz: 220,
        note: 'A3'
    },
    soprano: { 
        min: 196.00, 
        max: 523.25, 
        label: '(G3-C5)', 
        id: 1,
        hertz: 440,
        note: 'A4'
    }
};

/**
 * Get voice configuration by voice type
 * @param {string} voiceType - The type of voice (bass, tenor, alto, soprano)
 * @returns {Object} Voice configuration object
 */
export const getVoiceConfig = (voiceType) => {
    const config = VOICE_RANGES[voiceType.toLowerCase()];
    if (!config) {
        throw new Error(`Invalid voice type: ${voiceType}`);
    }
    return config;
};

/**
 * Generate a random frequency within a given voice range
 * @param {Object} voiceRange - Voice range configuration
 * @param {number} [minDuration=3] - Minimum note duration
 * @param {number} [maxDuration=8] - Maximum note duration
 * @returns {Object} Generated note object
 */
export const generateRandomNote = (voiceRange, minDuration = 20, maxDuration = 20) => {
    const frequency = Math.random() * (voiceRange.max - voiceRange.min) + voiceRange.min;
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    const note = getNoteName(frequency);
    
    return {
        frequency,
        duration,
        note
    };
};

/**
 * Get note name from a given frequency
 * @param {number} frequency - Frequency in Hz
 * @returns {string} Note name (e.g., 'A4')
 */
export const getNoteName = (frequency) => {
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

/**
 * Get all available voice types
 * @returns {string[]} Array of voice types
 */
export const getAllVoiceTypes = () => {
    return Object.keys(VOICE_RANGES);
};

const voiceTypesExport = {
    VOICE_RANGES,
    getVoiceConfig,
    generateRandomNote,
    getNoteName,
    getAllVoiceTypes
};

export default {
    VOICE_RANGES,
    getVoiceConfig,
    generateRandomNote,
    getNoteName,
    getAllVoiceTypes
};