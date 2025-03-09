import React, { useState, useEffect, useRef } from 'react';
import './DroneChoirPerformer.css';

const DroneChoirPerformer = () => {
  // State variables
  const [currentNote, setCurrentNote] = useState(null);
  const [nextNote, setNextNote] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceType, setVoiceType] = useState('bass');
  const [countdownTime, setCountdownTime] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [visualData, setVisualData] = useState({ frequency: 0, amplitude: 0 });
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  
  // Refs
  const audioElementRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const autoGenIntervalRef = useRef(null);
  const isPlayingRef = useRef(false);
  const audioQueueRef = useRef([]);
  
  // Voice ranges for different voice types
  const voiceRanges = {
    soprano: { min: 261.63, max: 880.00 },  // C4 to A5
    alto: { min: 174.61, max: 587.33 },     // F3 to D5
    tenor: { min: 130.81, max: 440.00 },    // C3 to A4
    bass: { min: 87.31, max: 329.63 }       // F2 to E4
  };

  useEffect(() => {
    audioQueueRef.current = audioQueue;
  }, [audioQueue]);
  
  // Initialize audio context
  const initAudio = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      
      setAudioContext(ctx);
      analyserRef.current = analyser;
      
      return { ctx, analyser };
    }
    
    return { ctx: audioContext, analyser: analyserRef.current };
  };
  
  // Generate a random frequency within the selected voice range
  const generateRandomFrequency = () => {
    const range = voiceRanges[voiceType];
    return Math.random() * (range.max - range.min) + range.min;
  };
  
  // Generate a random duration between 3 and 8 seconds
  const generateRandomDuration = () => {
    return Math.random() * 5 + 3; // 3 to 8 seconds
  };
  
  // Generate a note name from a frequency (simplified)
  const getNoteName = (frequency) => {
    // This is a simplified mapping that doesn't account for exact frequencies
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
  
  // Generate a new note
  const generateNewNote = () => {
    const frequency = generateRandomFrequency();
    const duration = generateRandomDuration();
    const note = getNoteName(frequency);
    
    return {
      frequency,
      duration,
      note
    };
  };
  
  // Auto-generate and add new notes to the queue
  const startAutoGeneration = () => {
    // Clear any existing interval
    if (autoGenIntervalRef.current) {
      clearInterval(autoGenIntervalRef.current);
    }
    
    // Generate initial note
    const initialNote = generateNewNote();
    updateAudioQueue([...audioQueueRef.current, initialNote]);
    
    // Start the interval for generating new notes
    autoGenIntervalRef.current = setInterval(() => {
      const newNote = generateNewNote();
      
      // Update queue with new note
      updateAudioQueue([...audioQueueRef.current, newNote]);
      console.log("Auto-generated new note:", newNote.note, "Queue length:", audioQueueRef.current.length);
      
      // If we're playing and this is the first note added, start playing
      if (isPlayingRef.current && audioQueueRef.current.length === 1) {
        playNextInQueue();
      }
    }, 5000); // Generate a new note every 5 seconds
    
    setAutoGenerate(true);
  };
  
  // Stop auto generation
  const stopAutoGeneration = () => {
    if (autoGenIntervalRef.current) {
      clearInterval(autoGenIntervalRef.current);
      autoGenIntervalRef.current = null;
    }
    
    setAutoGenerate(false);
  };

  const updateAudioQueue = (newQueue) => {
    if (typeof newQueue === 'function') {
      const updatedQueue = newQueue(audioQueueRef.current);
      audioQueueRef.current = updatedQueue;
      setAudioQueue(updatedQueue);
    } else {
      audioQueueRef.current = newQueue;
      setAudioQueue(newQueue);
    }
  };
  
  // Play the next note in the queue
  const playNextInQueue = () => {
    console.log("Playing next note from queue, queue length:", audioQueueRef.current.length);
    
    if (audioQueueRef.current.length === 0) {
      console.log("Queue empty, waiting for more notes...");
      // If there are no more notes but we're still playing,
      // wait for auto-generation to add more
      if (autoGenerate && isPlayingRef.current) {
        // Keep checking for new notes
        setTimeout(() => {
          console.log("Checking queue again, length:", audioQueueRef.current.length);
          if (audioQueueRef.current.length > 0 && isPlayingRef.current) {
            playNextInQueue();
          }
        }, 1000);
      } else {
        setCurrentNote(null);
        setNextNote(null);
      }
      return;
    }
    
    // Get the next note from the queue
    const nextNoteToPlay = audioQueueRef.current[0];
    console.log("Selected note to play:", nextNoteToPlay.note);
    
    // Update the queue - remove the first item
    const newQueue = audioQueueRef.current.slice(1);
    updateAudioQueue(newQueue);
    console.log("Updated queue length:", newQueue.length);
    
    // Set current and next note for display
    setCurrentNote(nextNoteToPlay);
    setNextNote(newQueue.length > 0 ? newQueue[0] : null);
    
    // Start countdown
    startCountdown(nextNoteToPlay.duration);
    
    // Play the note
    playNote(nextNoteToPlay);
  };
  
  // Play a specific note
  const playNote = (noteData) => {
    console.log("Playing note:", noteData.note, noteData.frequency, "Hz");
    
    // Initialize audio context first
    const { ctx, analyser } = initAudio();
    
    // Create new oscillator and gain node
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Stop any currently playing note AFTER creating the new ones
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        console.log("Error stopping previous oscillator:", e);
      }
      oscillatorRef.current = null;
    }
    
    // Set up oscillator
    oscillator.type = 'sine';
    oscillator.frequency.value = noteData.frequency;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(ctx.destination);
    
    // Apply slight fade-in
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.5);
    
    // Schedule fade-out
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + noteData.duration - 0.5);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + noteData.duration);
    
    // Store references
    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
    
    // Set up visualization
    setupVisualization();
    
    // Start oscillator AFTER everything is set up
    try {
      oscillator.start();
      console.log("Oscillator started successfully");
    } catch (e) {
      console.error("Error starting oscillator:", e);
    }
    
    // Schedule the end of the note
    const endTimeout = setTimeout(() => {
      console.log("Note ended, scheduling next note. isPlaying:", isPlayingRef.current);
      // Play the next note when the current one ends - use the ref instead of state
      if (isPlayingRef.current) {
        playNextInQueue();
      }
    }, noteData.duration * 1000);
    
    return () => {
      clearTimeout(endTimeout);
    };
  };
  
  // Start the performance
  const startPerformance = () => {
    console.log("Starting performance, queue length:", audioQueueRef.current.length);
    
    initAudio();
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    // Generate a note if queue is empty
    if (audioQueueRef.current.length === 0) {
      console.log("Queue is empty, generating initial note");
      const initialNote = generateNewNote();
      
      // Ensure complete queue reset before adding the new note
      audioQueueRef.current = [initialNote];
      setAudioQueue([initialNote]);
      
      // Give a moment for state to update
      setTimeout(() => {
        if (isPlayingRef.current) {
          console.log("Starting playback with newly generated note");
          playNextInQueue();
        }
      }, 50);
    } else {
      console.log("Starting playback with existing queue:", audioQueueRef.current.length, "notes");
      // Start playing if there are notes in the queue
      playNextInQueue();
    }
    
    // Start auto-generation if it's not already enabled
    if (!autoGenerate) {
      startAutoGeneration();
    }
  };
  
  // Handle countdown timer
  const startCountdown = (seconds) => {
    setCountdownTime(Math.round(seconds));
    
    const interval = setInterval(() => {
      setCountdownTime(prevTime => {
        const newTime = prevTime - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };
  
  // Stop the performance
  const stopPerformance = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;

    if (oscillatorRef.current) {
      const currentTime = audioContext.currentTime;
      
      // Fade out
      gainNodeRef.current.gain.setValueAtTime(
        gainNodeRef.current.gain.value, 
        currentTime
      );
      gainNodeRef.current.gain.linearRampToValueAtTime(0, currentTime + 0.5);
      
      // Stop after fade out
      setTimeout(() => {
        oscillatorRef.current.stop();
        oscillatorRef.current = null;
        
        // Cancel animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }, 500);
    }
  };
  
  // Set up waveform visualization
  const setupVisualization = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      // Get canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.fillStyle = 'rgb(20, 20, 40)';
      ctx.fillRect(0, 0, width, height);
      
      // Get frequency data
      analyser.getByteTimeDomainData(dataArray);
      
      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(100, 200, 250)';
      ctx.beginPath();
      
      const sliceWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      // Calculate frequency and amplitude for visualization
      let sum = 0;
      let maxValue = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(dataArray[i] - 128);
        sum += value;
        maxValue = Math.max(maxValue, value);
      }
      
      const avgAmplitude = sum / bufferLength;
      setVisualData({
        frequency: currentNote ? currentNote.frequency : 0,
        amplitude: avgAmplitude / 128
      });
      
      // Continue animation
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    // Start drawing
    draw();
  };
  
  // Reset canvas on resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          canvasRef.current.width = container.clientWidth;
          canvasRef.current.height = container.clientHeight;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up audio resources
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (autoGenIntervalRef.current) {
        clearInterval(autoGenIntervalRef.current);
      }
    };
  }, []);
  
  // Handle voice type change
  const handleVoiceTypeChange = (e) => {
    setVoiceType(e.target.value);
  };
  
  // Handle auto-generate toggle
  const handleAutoGenerateToggle = () => {
    if (autoGenerate) {
      stopAutoGeneration();
    } else {
      startAutoGeneration();
    }
  };
  
  // Add a single note to the queue
  const addNoteToQueue = () => {
    const newNote = generateNewNote();
    updateAudioQueue([...audioQueueRef.current, newNote]);
  };
  
  // Render voice type options
  const renderVoiceOptions = () => {
    const options = [
      { value: 'soprano', label: 'Soprano (C4-A5)' },
      { value: 'alto', label: 'Alto (F3-D5)' },
      { value: 'tenor', label: 'Tenor (C3-A4)' },
      { value: 'bass', label: 'Bass (F2-E4)' }
    ];
    
    return options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ));
  };
  
  // Render pitch indicator (visual aid for performers)
  const renderPitchIndicator = () => {
    if (!currentNote) return null;
    
    const getIndicatorStyle = () => {
      const amplitude = visualData.amplitude;
      return {
        height: `${Math.min(100, amplitude * 100)}%`,
        backgroundColor: isOnPitch() ? 'rgb(100, 250, 100)' : 'rgb(250, 100, 100)'
      };
    };
    
    const isOnPitch = () => {
      // In a real app, this would compare the performed pitch with the target
      return true;
    };
    
    return (
      <div className="pitch-indicator">
        <div 
          className="pitch-indicator-bar"
          style={getIndicatorStyle()}
        ></div>
      </div>
    );
  };
  
  return (
    <div className="drone-choir-container">
      <h1 className="app-title">Drone Choir System</h1>
      
      {/* Performer controls */}
      <div className="control-panel">
        <div className="voice-selector">
          <label>Voice Type:</label>
          <select 
            value={voiceType}
            onChange={handleVoiceTypeChange}
            className="voice-select"
          >
            {renderVoiceOptions()}
          </select>
        </div>
        
        <div className="control-buttons">
          <button
            onClick={isPlaying ? stopPerformance : startPerformance}
            className={`control-button ${isPlaying ? 'stop' : 'start'}`}
          >
            {isPlaying ? 'Stop Performance' : 'Start Performance'}
          </button>
        </div>
        
        <div className="auto-generate">
          <label>
            <input 
              type="checkbox" 
              checked={autoGenerate} 
              onChange={handleAutoGenerateToggle}
            />
            Auto-generate notes every 5 seconds
          </label>
        </div>
        
        <div className="queue-controls">
          <button className="queue-button add" onClick={addNoteToQueue}>
            Add Random Note
          </button>
        </div>
      </div>
      
      {/* Current note display */}
      <div className="note-display">
        <h2 className="section-title">Current Note</h2>
        
        {currentNote ? (
          <div className="note-info">
            <div className="note-details">
              <div className="note-name">{currentNote.note}</div>
              <div className="note-frequency">{currentNote.frequency.toFixed(2)} Hz</div>
            </div>
            
            <div className="countdown">
              <div className="countdown-time">
                {countdownTime}s
              </div>
              <div className="countdown-label">until next note</div>
            </div>
          </div>
        ) : (
          <div className="no-note">No note playing</div>
        )}
      </div>
      
      {/* Next note preview */}
      {nextNote && (
        <div className="note-display next-note">
          <h2 className="section-title">Coming Next</h2>
          <div className="note-info">
            <div className="note-details">
              <div className="note-name next">{nextNote.note}</div>
              <div className="note-frequency">{nextNote.frequency.toFixed(2)} Hz</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Queue display */}
      <div className="queue-display">
        <h2 className="section-title">Note Queue ({audioQueue.length})</h2>
        <div className="queue-items">
          {audioQueue.length === 0 ? (
            <div className="empty-queue">Queue is empty</div>
          ) : (
            audioQueue.slice(0, 5).map((queueItem, index) => (
              <div key={index} className="queue-item">
                <span className="queue-note">{queueItem.note}</span>
                <span className="queue-freq">{queueItem.frequency.toFixed(1)} Hz</span>
                <span className="queue-duration">{queueItem.duration.toFixed(1)}s</span>
              </div>
            ))
          )}
          {audioQueue.length > 5 && (
            <div className="queue-more">
              +{audioQueue.length - 5} more notes in queue
            </div>
          )}
        </div>
      </div>
      
      {/* Visualization area */}
      <div className="visualization-container">
        <div className="waveform-container">
          <canvas ref={canvasRef} className="waveform-canvas" />
        </div>
        {renderPitchIndicator()}
      </div>
      
      {/* Instructions */}
      <div className="instructions">
        <h2 className="section-title">Performance Instructions</h2>
        <ul className="instruction-list">
          <li>Listen for your note and match the pitch exactly</li>
          <li>Maintain a steady, pure tone</li>
          <li>Watch the countdown timer for upcoming note changes</li>
          <li>Breathe as needed, but try to stagger breaths with other performers</li>
          <li>The visualization shows the waveform of the ideal note to match</li>
        </ul>
      </div>
    </div>
  );
};

export default DroneChoirPerformer;