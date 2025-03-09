import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VOICE_RANGES, generateRandomNote, getNoteName } from './voiceTypes';
import './VoiceModule.css';
import FrequencyStreamClient from './FrequencyStreamClient';

const VoiceModule = forwardRef(({ voiceType, onPlayStateChange, sharedAudioContext }, ref) => {
  // State variables
  const [currentNote, setCurrentNote] = useState(null);
  const [nextNote, setNextNote] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdownTime, setCountdownTime] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [visualData, setVisualData] = useState({ frequency: 0, amplitude: 0 });
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const [streamClient, setStreamClient] = useState(null);
  const voiceRange = VOICE_RANGES[voiceType];
  
  // Refs
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const audioElementRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const autoGenIntervalRef = useRef(null);
  
  // Update audioContext when sharedAudioContext changes
  useEffect(() => {
    if (sharedAudioContext && !audioContext) {
      setAudioContext(sharedAudioContext);
      
      // Create an analyzer node for this module
      const analyser = sharedAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
    }
  }, [sharedAudioContext, audioContext]);

  // Initialize streaming client
  useEffect(() => {
    const client = new FrequencyStreamClient();
    client.connect();
    setStreamClient(client);

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, []);
  
  // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      startPerformance: (providedContext = null) => {
        if (providedContext && !audioContext) {
          setAudioContext(providedContext);
          const analyser = providedContext.createAnalyser();
          analyser.fftSize = 2048;
          analyserRef.current = analyser;
          
          // Small delay to ensure context is set
          setTimeout(() => {
            startPerformance();
          }, 50);
        } else {
          startPerformance();
        }
      },
      stopPerformance: () => {
        stopPerformance();
      },
      clearQueue: () => {
        updateAudioQueue([]);
        console.log(`${voiceType} queue cleared`);
      },
      addSpecificNote: (note) => {
        updateAudioQueue([note]);
        console.log(`${voiceType} added specific note: ${note.note} (${note.frequency.toFixed(2)} Hz)`);
      },
      get isPlaying() {
        return isPlayingRef.current;
      }
  }));
  
  // Initialize audio context
  const initAudio = () => {
    if (!audioContext) {
      // If no context exists, create a new one
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      
      setAudioContext(ctx);
      analyserRef.current = analyser;
      
      return { ctx, analyser };
    }
    
    // If there's no analyser yet but we have a context, create one
    if (!analyserRef.current && audioContext) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      return { ctx: audioContext, analyser };
    }
    
    return { ctx: audioContext, analyser: analyserRef.current };
  };
  
  // Sync the queue ref with state
  useEffect(() => {
    audioQueueRef.current = audioQueue;
  }, [audioQueue]);
  
  // Notify parent of play state changes
  useEffect(() => {
    if (onPlayStateChange) {
      onPlayStateChange(isPlaying);
    }
  }, [isPlaying, onPlayStateChange]);
  
  // Generate a random frequency within the voice range
  const generateRandomFrequency = () => {
    return Math.random() * (voiceRange.max - voiceRange.min) + voiceRange.min;
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
  
  // Update audio queue helper function
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
  
  // Auto-generate and add new notes to the queue
  const startAutoGeneration = () => {
    // Clear any existing interval
    if (autoGenIntervalRef.current) {
      clearInterval(autoGenIntervalRef.current);
    }
    
    // Generate initial note if queue is empty
    if (audioQueueRef.current.length === 0) {
      const initialNote = generateNewNote();
      updateAudioQueue([initialNote]);
      
      // If playing, start this note immediately
      if (isPlayingRef.current) {
        // Small delay to ensure state updates
        setTimeout(() => {
          playNextInQueue();
        }, 50);
      }
    }
    
    // Start the interval for generating new notes
    autoGenIntervalRef.current = setInterval(() => {
      const newNote = generateNewNote();
      console.log(`${voiceType} auto-generating new note: ${newNote.note}`);
      
      updateAudioQueue(prevQueue => {
        // Add the new note to the queue
        const updatedQueue = [...prevQueue, newNote];
        
        // If we're playing and queue was empty, start playing this note
        if (isPlayingRef.current && prevQueue.length === 0) {
          console.log(`${voiceType} starting playback with auto-generated note`);
          setTimeout(() => playNextInQueue(), 50);
        }
        
        return updatedQueue;
      });
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
  
  // Play the next note in the queue
  const playNextInQueue = () => {
    console.log(`${voiceType} playNextInQueue called, queue length: ${audioQueueRef.current.length}`);
    
    if (audioQueueRef.current.length === 0) {
      console.log(`${voiceType} queue is empty, checking auto-generate`);
      // If there are no more notes but we're still playing,
      // wait for auto-generation to add more
      if (autoGenerate && isPlayingRef.current) {
        console.log(`${voiceType} auto-generate is on, generating a new note`);
        // Generate a new note immediately instead of waiting
        const newNote = generateNewNote();
        
        // Update the queue with the new note
        updateAudioQueue([newNote]);
        
        // Start playing this note after a small delay to ensure state updates
        setTimeout(() => {
          if (isPlayingRef.current) {
            console.log(`${voiceType} playing newly generated note`);
            playNextInQueue();
          }
        }, 50);
      } else {
        console.log(`${voiceType} no more notes and auto-generate is off`);
        setCurrentNote(null);
        setNextNote(null);
      }
      return;
    }
    
    // Get the next note from the queue
    const nextNoteToPlay = audioQueueRef.current[0];
    console.log(`${voiceType} selected note to play: ${nextNoteToPlay.note}`);
    
    // Update the queue - remove the first item
    const newQueue = audioQueueRef.current.slice(1);
    updateAudioQueue(newQueue);
    
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
    // Make sure audio context is initialized
    if (!audioContext) {
      console.error(`No audio context available for ${voiceType}`);
      return;
    }
    
    // Ensure we have an analyser
    let analyser = analyserRef.current;
    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
    }
    
    // Stop any currently playing note
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current = null;
      } catch (e) {
        console.log(`Error stopping previous oscillator in ${voiceType}:`, e);
      }
    }
    
    // Create new audio nodes
    try {
      // Create new oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Set up oscillator
      oscillator.type = 'sine';
      oscillator.frequency.value = noteData.frequency;
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);
      
      // Apply slight fade-in
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.5);
      
      // Schedule fade-out
      gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + noteData.duration - 0.5);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + noteData.duration);
      
      // Store references
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      
      // Set up visualization
      setupVisualization();
      
      // Start oscillator
      oscillator.start();
      console.log(`${voiceType} playing note: ${noteData.note} (${noteData.frequency.toFixed(2)} Hz)`);
      
      // Schedule the end of the note and playing the next note
      const endTimeout = setTimeout(() => {
        // Play the next note when the current one ends
        if (isPlayingRef.current) {
          // Check if there are notes in the queue
          if (audioQueueRef.current.length > 0) {
            console.log(`${voiceType} scheduling next note from queue`);
            playNextInQueue();
          } else if (autoGenerate) {
            // If auto-generate is on but queue is empty, add a new note and play it
            console.log(`${voiceType} generating new note as queue is empty`);
            const newNote = generateNewNote();
            updateAudioQueue([newNote]);
            
            // Small delay to ensure state updates
            setTimeout(() => {
              if (isPlayingRef.current) {
                playNextInQueue();
              }
            }, 50);
          } else {
            console.log(`${voiceType} queue empty and auto-generate off, stopping playback`);
            setCurrentNote(null);
            setNextNote(null);
          }
        }
      }, noteData.duration * 1000);
      
      // Store the timeout so we can clear it if needed
      return () => clearTimeout(endTimeout);
    } catch (e) {
      console.error(`Error playing note in ${voiceType}:`, e);
    }
  };
  
  // Start the performance
  const startPerformance = (providedContext = null) => {
    // Initialize audio if needed
    const { ctx, analyser } = initAudio();
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    // Generate a note if queue is empty
    if (audioQueueRef.current.length === 0) {
      const initialNote = generateNewNote();
      updateAudioQueue([initialNote]);
      
      // Need to wait for state update before playing
      setTimeout(() => {
        if (isPlayingRef.current) {
          playNextInQueue();
        }
      }, 50);
    } else {
      // Start playing if there are notes in the queue
      playNextInQueue();
    }
    
    // Start auto-generation if it's not already on
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
    
    if (oscillatorRef.current && audioContext) {
      try {
        const currentTime = audioContext.currentTime;
        
        // Fade out
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.setValueAtTime(
            gainNodeRef.current.gain.value, 
            currentTime
          );
          gainNodeRef.current.gain.linearRampToValueAtTime(0, currentTime + 0.5);
        }
        
        // Stop after fade out
        setTimeout(() => {
          if (oscillatorRef.current) {
            oscillatorRef.current.stop();
            oscillatorRef.current = null;
          }
          
          // Cancel animation frame
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        }, 500);
      } catch (e) {
        console.error(`Error stopping performance in ${voiceType}:`, e);
      }
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
      if (oscillatorRef.current && audioContext) {
        try {
          oscillatorRef.current.stop();
        } catch (e) {
          console.log('Error cleaning up oscillator:', e);
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (autoGenIntervalRef.current) {
        clearInterval(autoGenIntervalRef.current);
      }
    };
  }, [audioContext]);
  
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
    const newNote = generateRandomNote(voiceRange);
    updateAudioQueue([...audioQueueRef.current, newNote]);
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
      <h2 className="voice-title">{voiceRange.label}</h2>
      
      {/* Performer controls */}
      <div className="control-panel">
        <div className="voice-selector">
          <div className="voice-type-label">{voiceRange.label}</div>
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
    </div>
  );
});

export default VoiceModule;