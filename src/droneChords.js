// droneChords.js
// A collection of harmonic chords for drone choir voices
// Each chord contains frequencies for: [bass, tenor, alto, soprano]
// Or in terms of the URL params: [low, low-mid, mid-high, high]

// Note frequencies (Hz) for reference
const NOTES = {
  // Low octaves
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31,
  'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  
  // Middle-low octaves  
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61,
  'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  
  // Middle octaves
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23,
  'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  
  // High octaves
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26, 'F5': 698.46,
  'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77
};

// Format: { name, notes: [noteNames], frequencies: [frequencies], description }
const droneChords = [
  // Root position triads and tetrads
  {
    name: "A Major",
    notes: ["A2", "E3", "A3", "C#4"],
    frequencies: [NOTES.A2, NOTES.E3, NOTES.A3, NOTES.C4],
    description: "Bright and stable A major chord"
  },
  {
    name: "A Minor",
    notes: ["A2", "E3", "A3", "C4"],
    frequencies: [NOTES.A2, NOTES.E3, NOTES.A3, NOTES.C4],
    description: "Melancholic A minor chord"
  },
  {
    name: "C Major",
    notes: ["C3", "G3", "C4", "E4"],
    frequencies: [NOTES.C3, NOTES.G3, NOTES.C4, NOTES.E4],
    description: "Pure and bright C major chord"
  },
  {
    name: "C Minor",
    notes: ["C3", "G3", "C4", "D#4"],
    frequencies: [NOTES.C3, NOTES.G3, NOTES.C4, NOTES.D4],
    description: "Dark and rich C minor chord"
  },

  // Perfect fifths
  {
    name: "Perfect Fifths on D",
    notes: ["D2", "A2", "D3", "A3"],
    frequencies: [NOTES.D2, NOTES.A2, NOTES.D3, NOTES.A3],
    description: "Open sound of stacked perfect fifths on D"
  },
  {
    name: "Perfect Fifths on G",
    notes: ["G2", "D3", "G3", "D4"],
    frequencies: [NOTES.G2, NOTES.D3, NOTES.G3, NOTES.D4],
    description: "Open sound of stacked perfect fifths on G"
  },

  // Suspended chords
  {
    name: "Dsus4",
    notes: ["D2", "G2", "A3", "D4"],
    frequencies: [NOTES.D2, NOTES.G2, NOTES.A3, NOTES.D4],
    description: "Suspended 4th chord on D with an open, unresolved character"
  },
  {
    name: "Esus2",
    notes: ["E2", "F#3", "B3", "E4"],
    frequencies: [NOTES.E2, NOTES.F3, NOTES.B3, NOTES.E4],
    description: "Suspended 2nd chord on E with an ethereal quality"
  },

  // Extended and altered chords
  {
    name: "Fmaj7",
    notes: ["F2", "C3", "A3", "E4"],
    frequencies: [NOTES.F2, NOTES.C3, NOTES.A3, NOTES.E4],
    description: "Warm and rich F major 7th chord"
  },
  {
    name: "G7",
    notes: ["G2", "F3", "B3", "D4"],
    frequencies: [NOTES.G2, NOTES.F3, NOTES.B3, NOTES.D4],
    description: "Dominant 7th chord on G with tension seeking resolution"
  },
  {
    name: "Bm7b5",
    notes: ["B2", "F3", "A3", "D4"],
    frequencies: [NOTES.B2, NOTES.F3, NOTES.A3, NOTES.D4],
    description: "Half-diminished chord on B, moody and unstable"
  },

  // Clusters and modern harmonies
  {
    name: "Whole Tone Cluster",
    notes: ["C3", "D3", "E3", "F#3"],
    frequencies: [NOTES.C3, NOTES.D3, NOTES.E3, NOTES.F3],
    description: "Whole-tone based cluster with an impressionistic sound"
  },
  {
    name: "Quartal Harmony",
    notes: ["C3", "F3", "B3", "E4"],
    frequencies: [NOTES.C3, NOTES.F3, NOTES.B3, NOTES.E4],
    description: "Chord built in perfect fourths, creating an open, modern sound"
  },

  // Drones and Special Harmonies
  {
    name: "Just Intonation A",
    notes: ["A2", "A3", "E4", "A4"],
    frequencies: [110.00, 220.00, 330.00, 440.00], // Pure harmonics of A
    description: "Pure harmonic series on A, perfectly in tune with natural overtones"
  },
  {
    name: "Overtone Series on C",
    notes: ["C2", "C3", "G3", "E4"],
    frequencies: [65.41, 130.81, 196.00, 329.63], // Follows natural overtone series of C
    description: "Natural overtone series based on C"
  },
  {
    name: "Meditative Drone",
    notes: ["G2", "D3", "G3", "B3"],
    frequencies: [NOTES.G2, NOTES.D3, NOTES.G3, NOTES.B3],
    description: "Calm, meditative drone in G with a peaceful quality"
  },

  // Unisons and Octaves
  {
    name: "A Unison/Octave Stack",
    notes: ["A2", "A3", "A4", "A5"],
    frequencies: [NOTES.A2, NOTES.A3, NOTES.A4, NOTES.A5],
    description: "Pure A tones across 4 octaves"
  },
  {
    name: "C Unison/Octave Stack",
    notes: ["C2", "C3", "C4", "C5"],
    frequencies: [NOTES.C2, NOTES.C3, NOTES.C4, NOTES.C5],
    description: "Pure C tones across 4 octaves"
  }
];

// Chord player template function
function playChord(chordIndex, voiceModuleRefs) {
  const chord = droneChords[chordIndex];
  if (!chord) {
    console.error(`No chord found at index ${chordIndex}`);
    return;
  }
  
  console.log(`Playing chord: ${chord.name} - ${chord.description}`);
  
  // Map to the four voice parts
  const voiceTypes = ['bass', 'tenor', 'alto', 'soprano'];
  
  // Create duration (could be adjusted per chord)
  const duration = 10; // 10 seconds per note
  
  // Apply to each voice
  voiceTypes.forEach((voiceType, index) => {
    if (voiceModuleRefs[voiceType]?.current) {
      const note = {
        frequency: chord.frequencies[index],
        duration: duration,
        note: chord.notes[index]
      };
      
      // Clear existing queue and add this note
      voiceModuleRefs[voiceType].current.clearQueue();
      voiceModuleRefs[voiceType].current.addSpecificNote(note);
    }
  });
}

// Function to get a random chord
function getRandomChord() {
  const randomIndex = Math.floor(Math.random() * droneChords.length);
  return droneChords[randomIndex];
}

// Export the chords and utility functions
export {
  NOTES,
  droneChords,
  playChord,
  getRandomChord
};

export default droneChords;