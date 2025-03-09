import React, { useState, useEffect, useRef } from 'react';
import './DroneChoirPerformer.css'; // We'll create this CSS file separately

const DroneChoirPerformer = () => {
  // State variables
  const [currentNote, setCurrentNote] = useState(null);
  const [nextNote, setNextNote] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceType, setVoiceType] = useState('bass');
  const [countdownTime, setCountdownTime] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [visualData, setVisualData] = useState({ frequency: 0, amplitude: 0 });
  
  // Refs
  const audioElementRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Example note sequence (would come from server in real app)
  const noteSequence = [
    { frequency: 110, duration: 10, note: 'A2' },
    { frequency: 123.47, duration: 10, note: 'B2' },
    { frequency: 130.81, duration: 10, note: 'C3' },
    { frequency: 146.83, duration: 10, note: 'D3' },
  ];
  
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
  
  // Start the performance
  const startPerformance = () => {
    const { ctx, analyser } = initAudio();
    
    // Create oscillator
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = noteSequence[0].frequency;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(ctx.destination);
    
    // Apply slight fade-in
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.5);
    
    // Store references
    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
    
    // Start oscillator
    oscillator.start();
    
    // Set up visualization
    setupVisualization();
    
    // Update state
    setIsPlaying(true);
    setCurrentNote(noteSequence[0]);
    setNextNote(noteSequence[1]);
    
    // Queue the next notes
    queueNextNotes(1);
  };
  
  // Queue up the next notes in sequence
  const queueNextNotes = (startIndex) => {
    if (startIndex >= noteSequence.length) {
      // End of sequence
      setTimeout(() => {
        stopPerformance();
      }, noteSequence[noteSequence.length - 1].duration * 1000);
      return;
    }
    
    const currentTime = audioContext.currentTime;
    let accumulatedTime = 0;
    
    for (let i = startIndex; i < noteSequence.length; i++) {
      const note = noteSequence[i];
      const previousNote = noteSequence[i - 1];
      const timeOffset = accumulatedTime + previousNote.duration;
      
      // Schedule the next note change
      setTimeout(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.setValueAtTime(
            note.frequency, 
            audioContext.currentTime
          );
          
          setCurrentNote(note);
          setNextNote(i < noteSequence.length - 1 ? noteSequence[i + 1] : null);
          
          // Start countdown for next note
          startCountdown(note.duration);
        }
      }, timeOffset * 1000);
      
      accumulatedTime += previousNote.duration;
    }
  };
  
  // Handle countdown timer
  const startCountdown = (seconds) => {
    setCountdownTime(seconds);
    
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
        
        setIsPlaying(false);
        setCurrentNote(null);
        setNextNote(null);
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
    };
  }, []);
  
  // Handle voice type change
  const handleVoiceTypeChange = (e) => {
    setVoiceType(e.target.value);
  };
  
  // Render voice type options
  const renderVoiceOptions = () => {
    const options = [
      { value: 'soprano', label: 'Soprano (C4-C6)', baseFreq: 523.25 },
      { value: 'alto', label: 'Alto (F3-F5)', baseFreq: 349.23 },
      { value: 'tenor', label: 'Tenor (C3-C5)', baseFreq: 261.63 },
      { value: 'bass', label: 'Bass (E2-E4)', baseFreq: 130.81 }
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
            disabled={isPlaying}
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