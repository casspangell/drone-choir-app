import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DroneChoirPerformer.css';
import VoiceModule from './VoiceModule';
import { startUnison, startAll, stopAll } from './performance';
import { VOICE_RANGES } from './voiceTypes';
import useFrequencyStreaming from './useFrequencyStreaming';
import TimeSyncUtils from './TimeSyncUtils';

const DroneChoirPerformer = () => {
  // Use the streaming hook - add isMaster to the destructured values
  const {
    isConnected,
    error,
    startFrequencyStream,
    stopAllStreams,
    voiceStates,
    updateNotes,
    isMaster,
    checkMasterStatus
  } = useFrequencyStreaming();

  // State for controlling all modules
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [soloVoice, setSoloVoice] = useState(null);
  const [isSolo, setIsSolo] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ synced: false, offset: 0 });
  const [audioContextState, setAudioContextState] = useState('unknown');
  const [isMasterMode, setIsMasterMode] = useState(false);

  const [instanceId] = useState(() => {
    // Try to get existing ID from localStorage
    const savedId = localStorage.getItem('droneChoirInstanceId');
    if (savedId) {
      return savedId;
    }
    
    // Generate a new ID and save it
    const newId = Math.random().toString(36).substring(2, 9);
    localStorage.setItem('droneChoirInstanceId', newId);
    return newId;
  });
  
  // Create refs to access the voice module methods
  const voiceModuleRefs = {
    soprano: useRef(),
    alto: useRef(),
    tenor: useRef(),
    bass: useRef()
  };
  
  // Create a shared audio context
  const [sharedAudioContext, setSharedAudioContext] = useState(null);
  
  // Initialize shared audio context on first interaction
  const initSharedAudioContext = useCallback(() => {
    if (!sharedAudioContext) {
      const newContext = new (window.AudioContext || window.webkitAudioContext)();
      setSharedAudioContext(newContext);
      return newContext;
    }
    return sharedAudioContext;
  }, [sharedAudioContext]);

  useEffect(() => {
    if (sharedAudioContext) {
      setAudioContextState(sharedAudioContext.state);
      
      // Add an event listener to detect state changes
      const handleStateChange = () => {
        setAudioContextState(sharedAudioContext.state);
      };
      
      sharedAudioContext.addEventListener('statechange', handleStateChange);
      
      return () => {
        sharedAudioContext.removeEventListener('statechange', handleStateChange);
      };
    }
  }, [sharedAudioContext]);

  // to monitor sync status
  useEffect(() => {
    // Check sync status periodically
    const syncCheckInterval = setInterval(() => {
      const status = TimeSyncUtils.getSyncStatus();
      setSyncStatus(status);
    }, 5000);
    
    return () => clearInterval(syncCheckInterval);
  }, []);

  // Update UI based on the master status from the useFrequencyStreaming hook
  useEffect(() => {
    if (isMaster !== undefined) {
      setIsMasterMode(isMaster);
      console.log(`isMaster state changed: ${isMaster}`);
      console.log(`This client (${instanceId}) is ${isMaster ? 'MASTER' : 'SLAVE'} mode`);
    }
  }, [isMaster, instanceId]);

  const ensureAudioContextRunning = useCallback(() => {
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      console.log('Attempting to resume suspended audio context');
      sharedAudioContext.resume().then(() => {
        console.log('Audio context resumed successfully');
      }).catch(err => {
        console.error('Failed to resume audio context:', err);
      });
    }
  }, [sharedAudioContext]);

  // Sync with server voice states
  useEffect(() => {
    if (Object.keys(voiceStates).length > 0) {
      ensureAudioContextRunning();
      let anyPlaying = false;
      
      // Update each voice module with server state
      Object.entries(voiceStates).forEach(([voiceType, state]) => {
        const ref = voiceModuleRefs[voiceType];
        if (ref && ref.current) {
          // If the server says the voice is playing but our local state is not
          if (state.isPlaying) {
            anyPlaying = true;
            
            // If we have notes in the queue, update the module
            if (state.noteQueue && state.noteQueue.length > 0) {
              // First clear existing queue
              ref.current.clearQueue();
              
              // Then add all notes from server
              state.noteQueue.forEach(note => {
                ref.current.addSpecificNote(note);
              });
              
              // Start the voice if it's not already playing
              if (!ref.current.isPlaying) {
                console.log(`Starting ${voiceType} based on server state`);
                ref.current.startPerformance(sharedAudioContext || initSharedAudioContext());
              }
            }
          } else if (!state.isPlaying && ref.current.isPlaying) {
            // If server says not playing but we are, stop
            ref.current.stopPerformance();
          }
        }
      });
      
      // Update master playing state
      setIsAllPlaying(anyPlaying);
    }
  }, [voiceStates, initSharedAudioContext, sharedAudioContext, ensureAudioContextRunning]);

  const handleVoiceSelection = (voiceType) => {
    if (soloVoice === voiceType) {
      // Deselect if the same voice is clicked again
      setSoloVoice(null);

      // ✅ Deselect all voice modules
      Object.values(voiceModuleRefs).forEach(ref => {
        if (ref.current) {
          ref.current.setIsSolo(false);
          ref.current.setIsSelected(false);  // Explicitly unselect
        }
      });

    } else {
      // Select the new voice
      setSoloVoice(voiceType);

      // ✅ Ensure only the selected voice is active
      Object.entries(voiceModuleRefs).forEach(([refVoiceType, ref]) => {
        if (ref.current) {
          const isSelected = refVoiceType === voiceType;
          ref.current.setIsSolo(isSelected);
          ref.current.setIsSelected(isSelected);  // Ensure UI reflects selection
        }
      });
    }
  };

  // Modify auto-generation and note generation logic based on master/slave status
  const addNoteToQueue = useCallback((voiceType, note) => {
    if (!isMasterMode) {
      console.log('Slave mode - cannot add notes to queue');
      return; // Only the master can add notes
    }
    
    // Continue with adding notes to queue
    if (note) {
      updateNotes(voiceType, [note]);
    }
  }, [isMasterMode, updateNotes]);
  
  // Function to start all voices on a scheduled note
  const startUnisonScheduled = (voiceModuleRefs, initSharedAudioContext, setIsAllPlaying, unisonNote) => {
    console.log(`Starting all voices on fixed pitch at scheduled time: ${new Date(unisonNote.scheduledStartTime).toISOString()}`);
    
    // Initialize the shared audio context
    const ctx = initSharedAudioContext();
    
    // Clear existing queues in all voice modules and add the common note
    Object.entries(voiceModuleRefs).forEach(([voiceType, ref]) => {
      if (ref.current) {
        // First clear the queue
        ref.current.clearQueue();
        // Then add the common note
        ref.current.addSpecificNote(unisonNote);
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
  
  // Handle the master control button click
  const handleMasterControlClick = useCallback(() => {
    if (isAllPlaying) {
      // Stop all streaming frequencies
      stopAllStreams();
      // Stop all voice modules
      stopAll(voiceModuleRefs, setIsAllPlaying);
    } else {
      // Start streaming for each voice type
      Object.values(VOICE_RANGES).forEach(voiceConfig => {
        startFrequencyStream(voiceConfig.id);
      });
      
      // Start all voice modules
      startAll(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying);
    }
  }, [isAllPlaying, startFrequencyStream, stopAllStreams, initSharedAudioContext]);
  
  // Handle unison start button click
  const handleUnisonStart = useCallback(() => {
    // Common pitch for unison
    const commonPitch = 220; // A3
    const noteName = 'A3';

    // Calculate a start time in the future to allow for network latency
    // We'll schedule it 1.5 seconds in the future to ensure all clients have time to receive the message
    const scheduledStartTime = TimeSyncUtils.getEstimatedServerTime() + 1500;
    
    // Create the unison note with scheduled time
    const unisonNote = {
      frequency: commonPitch,
      duration: 10,
      note: noteName,
      scheduledStartTime: scheduledStartTime
    };
  
    // Call the unison API endpoint
    fetch('http://localhost:8080/api/unison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pitch: commonPitch,
        note: noteName,
        duration: 10,
        scheduledStartTime: scheduledStartTime,
        instanceId: instanceId // Add instanceId to check master permission
      })
    }).catch(error => console.error('Error setting unison:', error));
    
    // Continue with existing logic
    Object.values(VOICE_RANGES).forEach(voiceConfig => {
      startFrequencyStream(voiceConfig.id);
    });
    
    // Start the scheduled unison performance
    startUnisonScheduled(voiceModuleRefs, initSharedAudioContext, setIsAllPlaying, unisonNote);
  }, [startFrequencyStream, initSharedAudioContext, instanceId]);

  // Handle note queue updates
  const handleNoteQueueUpdate = useCallback((voiceType, notes) => {
    // Only allow master to update notes
    if (!isMasterMode) {
      console.log(`Cannot update notes in slave mode for ${voiceType}`);
      return;
    }
    
    // Update server with new notes
    updateNotes(voiceType, notes);
  }, [updateNotes, isMasterMode]);

  return (
    <div className="drone-choir-multi">
      <div style={{padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px', textAlign: 'center'}}>
        Current Audio Context State: {audioContextState || 'No AudioContext'}
      </div>

      <div className="connection-status">
        <span 
          className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? 'Streaming: Connected' : 'Streaming: Disconnected'}
        </span>
        <span 
          className={`sync-indicator ${syncStatus.synced ? 'synced' : 'out-of-sync'}`}
          title={`Time offset: ${syncStatus.offset.toFixed(0)}ms`}
        >
          {syncStatus.synced ? 'Time Synced' : 'Not Synced'}
        </span>
        <span 
          className={`mode-indicator ${isMasterMode ? 'master' : 'slave'}`}
          onClick={() => checkMasterStatus && checkMasterStatus()} // Add click handler to refresh status
        >
          {isMasterMode ? 'Master Mode' : 'Slave Mode'}
        </span>
      </div>

      {/* Audio context warning */}
      {audioContextState === 'suspended' && (
        <div className="audio-warning">
          <p>Click or tap anywhere on the page to enable audio playback</p>
          <button 
            onClick={() => sharedAudioContext?.resume()}
            className="audio-enable-button"
          >
            Enable Audio
          </button>
        </div>
      )}
        
      {/* Connection status and error handling */}
      {error && (
        <div className="connection-error">
          <p>Streaming Error: {error.message || 'Connection failed'}</p>
        </div>
      )}

      {/* Master controls */}
      <div className="master-controls">
        <button
          onClick={handleUnisonStart}
          className="master-control-button initial"
          disabled={!isConnected || (!isMasterMode && handleUnisonStart.name !== 'unison')}
        >
          Start All on Same Pitch (10s)
        </button>
        <button
          onClick={handleMasterControlClick}
          className={`master-control-button ${isAllPlaying ? 'stop' : 'start'}`}
          disabled={!isConnected}
        >
          {isAllPlaying ? 'Stop All Voices' : 'Start All Voices'}
        </button>
      </div>
      
      {/* Voice modules grid */}
      <div className="voice-modules-grid">
        {Object.entries(VOICE_RANGES).map(([voiceType, range]) => (
          <VoiceModule 
            key={voiceType}
            voiceType={voiceType} 
            voiceRange={range}
            isSelected={soloVoice === voiceType}
            ref={voiceModuleRefs[voiceType]}
            sharedAudioContext={sharedAudioContext}
            onPlayStateChange={(isPlaying) => {
              // Check if any module is still playing when one stops
              if (!isPlaying) {
                const anyStillPlaying = Object.values(voiceModuleRefs).some(
                  ref => ref.current && ref.current.isPlaying
                );
                
                if (!anyStillPlaying) {
                  setIsAllPlaying(false);
                }
              }
            }}
            onSoloToggle={handleVoiceSelection}
            isSoloMode={soloVoice !== null}
            isCurrentSolo={soloVoice === voiceType}
            soloVoice={soloVoice}
            onNoteQueueUpdate={(notes) => handleNoteQueueUpdate(voiceType, notes)}
            isMasterMode={isMasterMode} // Pass master/slave status
          />
        ))}
      </div>
    </div>
  );
};

export default DroneChoirPerformer;