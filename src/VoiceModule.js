import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VOICE_RANGES, generateRandomNote, getNoteName } from './voiceTypes';
import './VoiceModule.css';

const VoiceModule = forwardRef(({ 
  voiceType, 
  onPlayStateChange, 
  sharedAudioContext, 
  onSoloToggle, 
  isSoloMode, 
  isCurrentSolo, 
  isViewerMode = false,
  isSingleMode = false
}, ref) => {
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
  const [isSolo, setIsSolo] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isDashboardMuted, setIsDashboardMuted] = useState(false);
  
  // Refs
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const autoGenIntervalRef = useRef(null);
  const audioContextRef = useRef(null);

  // Mapping for URL parameters to voice types
  const voiceRangeMapping = {
    'high': 'soprano',
    'mid-high': 'alto',
    'low-mid': 'tenor',
    'low': 'bass'
  };

  // To manage periodic queue checking
  useEffect(() => {
    // Only start checking if the module is playing
    if (!isPlayingRef.current) return;

    // Create an interval to check the queue
    const queueCheckInterval = setInterval(() => {
      // Check if no oscillator is currently playing and there are notes in the queue
      if (!oscillatorRef.current && audioQueueRef.current.length > 0) {
        console.log(`${voiceType} periodic queue check triggered`);
        playNextInQueue();
      }
    }, 2000); // Check every 2 seconds

    // Cleanup interval when component unmounts or stops playing
    return () => {
      clearInterval(queueCheckInterval);
    };
  }, [isPlayingRef.current, audioQueueRef.current.length]);

  // Effect for checking URL query parameters and detecting single voice mode
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
        break;
      }
    }
    
    console.log('Range params checked:', rangeParams);
  }, []);
  
  // Initialize audio context on component mount
  useEffect(() => {
    // Prioritize shared context, otherwise create a new one
    if (sharedAudioContext) {
      audioContextRef.current = sharedAudioContext;
    } else {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Cleanup audio context when component unmounts
    return () => {
      if (audioContextRef.current && audioContextRef.current !== sharedAudioContext) {
        audioContextRef.current.close();
      }
    };
  }, [sharedAudioContext]);

  useEffect(() => {
    // Add or remove 'playing' class based on isPlaying state
    const container = document.querySelector('.single-voice-container');
    if (container) {
      if (isPlaying) {
        container.classList.add('playing');
      } else {
        container.classList.remove('playing');
      }
    }
  }, [isPlaying]);
  
  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    setAudioContext: (context) => {
      console.log(`Setting audio context for ${voiceType}`);
      if (context && context !== audioContextRef.current) {
        audioContextRef.current = context;
        
        // Create an analyser if needed
        if (!analyserRef.current) {
          const analyser = context.createAnalyser();
          analyser.fftSize = 2048;
          analyserRef.current = analyser;
        }
        
        console.log(`Audio context set for ${voiceType}, state: ${context.state}`);
        
        // If the context is suspended, try to resume it
        if (context.state === 'suspended') {
          context.resume().then(() => {
            console.log(`Audio context resumed for ${voiceType}`);
          }).catch(err => {
            console.error(`Failed to resume audio context for ${voiceType}:`, err);
          });
        }
      }
    },
    getFullQueue: () => {
      return audioQueueRef.current;
    },
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
    getCurrentNote: () => {
      return currentNote;
    },
    getNextNote: () => {
      return nextNote;
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
    },
    toggleSolo: () => {
      console.log(`Toggling solo for ${voiceType}`);
      const newSoloState = !isSolo;
      setIsSolo(newSoloState);
      
      if (onSoloToggle) {
        console.log(`Calling onSoloToggle with ${voiceType}, ${newSoloState}`);
        onSoloToggle(voiceType, newSoloState);
      }
    },
    get isSolo() {
      return isSolo;
    },
    adjustVolume: (soloVolume) => {
      adjustVolumeForSolo(soloVolume);
    },
    get isSolo() {
      return isSolo;
    },
    get isSelected() {
      return isSelected;
    },
    addSpecificNoteToQueue: (note) => {
      updateAudioQueue(prevQueue => {
        // Only add if the note is not already in the queue
        const isNoteAlreadyInQueue = prevQueue.some(
          existingNote => existingNote.note === note.note
        );
        
        if (!isNoteAlreadyInQueue) {
          console.log(`${voiceType} adding note to queue: ${note.note}`);
          return [...prevQueue, note];
        }
        
        return prevQueue;
      });
    },
  }));

  // Initialize audio context
  const initAudio = () => {
    // If no context exists, create a new one
    if (!audioContext) {
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
  
    // Stop auto generation
    const stopAutoGeneration = () => {
      if (autoGenIntervalRef.current) {
        clearInterval(autoGenIntervalRef.current);
        autoGenIntervalRef.current = null;
      }
      
      setAutoGenerate(false);
    };

    const resumeAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log(`Resuming audio context for ${voiceType}`);
        audioContextRef.current.resume().then(() => {
          console.log(`Audio context resumed successfully for ${voiceType}`);
          // Add class to container to indicate audio is enabled
          const container = document.querySelector('.drone-choir-container');
          if (container) {
            container.classList.add('audio-enabled');
          }
        }).catch(err => {
          console.error(`Failed to resume audio context for ${voiceType}:`, err);
        });
      } else {
        console.log(`Audio context is already running or not available for ${voiceType}`);
        // Add class to container in case it's already running
        const container = document.querySelector('.drone-choir-container');
        if (container) {
          container.classList.add('audio-enabled');
        }
      }
    };
  
  // Play the next note in the queue
  const playNextInQueue = () => {
    console.log(`${voiceType} playNextInQueue called, queue length: ${audioQueueRef.current.length}`);
    
  // Check if there are notes in the queue
    if (audioQueueRef.current.length > 0) {
      // Get the next note from the queue
      const nextNoteToPlay = audioQueueRef.current[0];
      console.log(`${voiceType} selected note to play: ${nextNoteToPlay.note}`);
      
      // Remove the first item from the queue
      const newQueue = audioQueueRef.current.slice(1);
      updateAudioQueue(newQueue);
      
      // Set current and next note for display
      setCurrentNote(nextNoteToPlay);
      setNextNote(newQueue.length > 0 ? newQueue[0] : null);
      
      // Start countdown
      startCountdown(nextNoteToPlay.duration);
      
      // Play the note
      playNote(nextNoteToPlay);
    } else {
      console.log(`${voiceType} queue is empty, no notes to play`);
      setCurrentNote(null);
      setNextNote(null);
    }
  };

  const updateAudioQueue = (newQueue) => {
    let updatedQueue;
    if (typeof newQueue === 'function') {
      updatedQueue = newQueue(audioQueueRef.current);
    } else {
      updatedQueue = newQueue;
    }
    
    // Ensure the queue is always an array
    updatedQueue = Array.isArray(updatedQueue) ? updatedQueue : [];
    
    // Update both the ref and the state
    audioQueueRef.current = updatedQueue;
    setAudioQueue(updatedQueue);
    
    console.log(`${voiceType} queue updated:`, updatedQueue);
  };
  
  // Modify playNote to use the consistent audio context
  const playNote = (noteData) => {
    const ctx = audioContextRef.current;
    const gainMultiplier = (isSoloMode && !isCurrentSolo) ? 0 : 1;

    if (!ctx) {
      console.error(`No audio context available for ${voiceType}`);
      return;
    }
    
    // Stop any currently playing note completely
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
        }
        
        // Cancel any existing animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        oscillatorRef.current = null;
        gainNodeRef.current = null;
      } catch (e) {
        console.log(`Error stopping previous oscillator in ${voiceType}:`, e);
      }
    }
    
    // Create new audio nodes using the consistent context
    try {
      // Create new oscillator
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Create an analyser for visualization
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      // Set up oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(noteData.frequency, ctx.currentTime);
      
      // Implement 5-second fade in and out
      const noteDuration = noteData.duration;
      const fadeDuration = 5; // 5-second fade
      
      // Calculate actual fade durations
      const fadeInDuration = Math.min(fadeDuration, noteDuration / 2);
      const fadeOutDuration = Math.min(fadeDuration, noteDuration / 2);
      
      console.log(`[${voiceType}] Note Details:`, {
        note: noteData.note,
        frequency: noteData.frequency,
        totalDuration: noteDuration,
        fadeInDuration,
        fadeOutDuration,
        maxGain: noteData.max_gain
      });

      // Gain control with detailed logging
      console.log(`[${voiceType}] Starting gain at near-zero`);
      const maxGain = noteData.max_gain || 0.5; // Get max_gain from noteData or set a default value
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);

      console.log(`[${voiceType}] Fade-in: 0.001 -> ${maxGain} over ${fadeInDuration} seconds`);
      gainNode.gain.exponentialRampToValueAtTime(
        maxGain * gainMultiplier,
        ctx.currentTime + fadeInDuration
      );

      // Maintain volume if note is longer than fade-in + fade-out
      if (noteDuration > fadeInDuration * 2) {
        console.log(`[${voiceType}] Maintaining volume at ${maxGain} for sustained period`);
        gainNode.gain.setValueAtTime(
          maxGain * gainMultiplier, 
          ctx.currentTime + noteDuration - fadeOutDuration
        );
      }

      console.log(`[${voiceType}] Fade-out: ${maxGain} -> 0.001 over ${fadeOutDuration} seconds`);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001, // Near zero, not completely zero to avoid click
        ctx.currentTime + noteDuration
      );
      
      // Connect nodes with analyser
      oscillator.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);
      
      // Store references
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      
      // Set up visualization before starting
      setupVisualization();
      
      // Start and schedule stop
      oscillator.start();
      oscillator.stop(ctx.currentTime + noteDuration);
      
      console.log(`${voiceType} playing note: ${noteData.note} (${noteData.frequency.toFixed(2)} Hz)`);
      
      // Schedule cleanup
      oscillator.onended = () => {
        console.log(`${voiceType} note finished: ${noteData.note} (${noteData.frequency.toFixed(2)} Hz)`);

        oscillator.disconnect();
        gainNode.disconnect();
        analyser.disconnect();
        
        if (oscillatorRef.current === oscillator) {
          oscillatorRef.current = null;
        }
        if (gainNodeRef.current === gainNode) {
          gainNodeRef.current = null;
        }
        
        // Stop animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        playNextInQueue();
      };
    } catch (e) {
      console.error(`Error playing note in ${voiceType}:`, e);
    }
  };

const adjustVolumeForSolo = (soloVolume) => {
  if (gainNodeRef.current) {
    try {
      const ctx = audioContextRef.current;
      if (ctx) {
        // Immediately set the gain value
        gainNodeRef.current.gain.setValueAtTime(soloVolume, ctx.currentTime);
      }
    } catch (error) {
      console.error(`Error adjusting volume for ${voiceType}:`, error);
    }
  }
};
  
  const startPerformance = (providedContext = null) => {
    console.log(`Starting performance for ${voiceType} - checking audio initialization`);
    
    // Use provided context or the existing context
    const ctx = providedContext || audioContextRef.current;

    // Prevent auto-generation in viewer mode
    const shouldAutoGenerate = !isViewerMode && !isSingleMode;
    
    if (!ctx) {
      console.error(`Failed to initialize audio context for ${voiceType}`);
      return;
    }
    
    // Initialize analyser if not exists
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
    }
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    // Generate a note if queue is empty
    // if (audioQueueRef.current.length === 0) {
      // const initialNote = generateRandomNote(voiceRange);//kilroy
      // updateAudioQueue([initialNote]);
    // }
    
    // Play next in queue
    setTimeout(() => {
      if (isPlayingRef.current) {
        playNextInQueue();
      }
    }, 50);
    
    // Start auto-generation if it's not already on and allowed
    // if (shouldAutoGenerate && !autoGenerate) {
    //   startAutoGeneration();
    // }
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
    
    // Stop auto-generation
    if (autoGenerate) {
      stopAutoGeneration();
    }
    
    // Clear the queue
    updateAudioQueue([]);
    
    if (oscillatorRef.current && audioContextRef.current) {
      try {
        const currentTime = audioContextRef.current.currentTime;
        
        // Fade out over 0.5 seconds
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
            oscillatorRef.current.disconnect();
            oscillatorRef.current = null;
          }
          
          if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
            gainNodeRef.current = null;
          }
          
          // Cancel animation frame
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          
          // Reset states
          setCurrentNote(null);
          setNextNote(null);
          setCountdownTime(0);
          
        }, 500);
      } catch (e) {
        console.error(`Error stopping performance in ${voiceType}:`, e);
      }
    }
    
    console.log(`${voiceType} performance stopped`);
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
    // if (autoGenerate) {
    //   stopAutoGeneration();
    // } else {
    //   startAutoGeneration();
    // }
  };
  
  // Add a single note to the queue
  const addNoteToQueue = () => {
    // const newNote = generateRandomNote(voiceRange);//kilroy
    // updateAudioQueue(prevQueue => {
    //   const updatedQueue = [...prevQueue, newNote];
      
    //   // If nothing is playing, start playing the new note
    //   if (isPlayingRef.current && !oscillatorRef.current) {
    //     setTimeout(() => {
    //       playNextInQueue();
    //     }, 50);
    //   }
      
    //   return updatedQueue;
    // });
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

  const renderGainMeter = () => {
    const getGainMeterStyle = () => {
      const amplitude = visualData.amplitude;
      return {
        height: `${Math.min(100, amplitude * 100)}%`,
        backgroundColor: 'rgb(250, 100, 100)',
        transformOrigin: 'bottom',
        transform: 'scaleY(1)'
      };
    };
    
    return (
      <div className="gain-meter">
        <div 
          className="gain-meter-bar"
          style={getGainMeterStyle()}
        ></div>
      </div>
    );
  };

  // Helper function to get range label
  const getRangeLabel = (voiceType) => {
    return Object.entries(voiceRangeMapping).find(
      ([_, value]) => value === voiceType
    )?.[0]?.toUpperCase() || 'VOICE';
  };

  const rangeLabel = getRangeLabel(voiceType);
  
return (
  <div className={`drone-choir-container ${isSelected ? 'selected' : ''} ${isSingleMode ? 'single-mode' : ''}`} >
      
  {isSingleMode && (
    <div className="enable-audio-container">
      <button 
        className="enable-audio-button"
        onClick={resumeAudioContext}
      >
        ENABLE AUDIO
      </button>
      <div className="enable-instruction">
        Click the button above to enable audio for this voice
      </div>
    </div>
  )}
    
    {/* Current note display */}
   <div className="note-display-row">
      {/* Current note display */}
      <div className="note-display current-note">
        <h2 className="section-title">Current Note</h2>
        
        {currentNote ? (
          <div className="note-info">
            <div className="note-details">
              <div className={`note-name ${isSingleMode ? 'large-note' : ''}`}>{currentNote.note}</div>
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
    </div>
    
    {/* Queue display - conditionally show less detail in single mode */}
    <div className="queue-display">
      <h2 className="section-title">Note Queue ({audioQueue.length})</h2>
      <div className="queue-items">
        {audioQueue.length === 0 ? (
          <div className="empty-queue">Queue is empty</div>
        ) : (
          audioQueue.slice(0, isSingleMode ? 3 : 5).map((queueItem, index) => (
            <div key={index} className="queue-item">
              <span className="queue-note">{queueItem.note}</span>
              <span className="queue-freq">{queueItem.frequency.toFixed(1)} Hz</span>
              <span className="queue-duration">{queueItem.duration.toFixed(1)}s</span>
            </div>
          ))
        )}
        {audioQueue.length > (isSingleMode ? 3 : 5) && (
          <div className="queue-more">
            +{audioQueue.length - (isSingleMode ? 3 : 5)} more notes in queue
          </div>
        )}
      </div>
    </div>
    
    {/* Visualization area - enhanced for single mode */}
    <div className={`visualization-container ${isSingleMode ? 'enhanced-visualization' : ''}`}>
      <div className="waveform-container">
        <canvas ref={canvasRef} className="waveform-canvas" />
      </div>
      {renderPitchIndicator()}
      {renderGainMeter()}
    </div>
  </div>
);
});

export default VoiceModule;