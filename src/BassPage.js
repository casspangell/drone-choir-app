// src/BassPage.js
import React, { useState, useEffect, useRef } from 'react';
import VoiceModule from './VoiceModule';
import { VOICE_RANGES } from './voiceTypes';

function BassPage() {
  const [audioContext, setAudioContext] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const voiceModuleRef = useRef(null);
  const [serverState, setServerState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Initialize audio context on component mount
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(ctx);
    
    return () => {
      if (ctx) {
        ctx.close();
      }
    };
  }, []);
  
  useEffect(() => {
  // Clear the queue when the component first mounts
  if (voiceModuleRef.current) {
    voiceModuleRef.current.clearQueue();
  }
}, []);

  // Set up polling to the server
useEffect(() => {
  const pollServer = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/voice/bass');
      if (response.ok) {
        const data = await response.json();
        console.log('BASS PAGE received full server data:', data);
        
        // Only update if there's an actual change in the server state
        const hasQueueChanged = !serverState || 
                               JSON.stringify(data.noteQueue) !== JSON.stringify(serverState.noteQueue);
        const hasPlayStateChanged = !serverState || data.isPlaying !== serverState.isPlaying;
        
        // Update the state regardless
        setServerState(data);
        setIsConnected(true);
        
        // Sync with server if needed
        if (voiceModuleRef.current) {
          // Handle play state changes
          if (hasPlayStateChanged) {
            if (data.isPlaying && !isPlaying) {
              voiceModuleRef.current.startPerformance(audioContext);
              setIsPlaying(true);
            } else if (!data.isPlaying && isPlaying) {
              voiceModuleRef.current.stopPerformance();
              setIsPlaying(false);
            }
          }
          
          // Handle note queue changes (only if queue actually changed)
          if (hasQueueChanged && data.noteQueue && data.noteQueue.length > 0) {
            console.log('BASS PAGE applying queue change:', data.noteQueue);
            
            // Clear and apply new queue
            voiceModuleRef.current.clearQueue();
            data.noteQueue.forEach(note => {
              // Process note
              const processedNote = {
                ...note,
                frequency: typeof note.frequency === 'string' ? parseFloat(note.frequency) : note.frequency,
                duration: typeof note.duration === 'string' ? parseFloat(note.duration) : note.duration
              };
              voiceModuleRef.current.addSpecificNote(processedNote);
            });
            
            // Force trigger playback by stopping and restarting performance
            if (data.isPlaying) {
              // First stop any existing performance
              voiceModuleRef.current.stopPerformance();
              
              // Short delay then restart
              setTimeout(() => {
                // Restart performance to properly trigger playback
                voiceModuleRef.current.startPerformance(audioContext);
                setIsPlaying(true);
              }, 100);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching bass state:', error);
      setIsConnected(false);
    }
  };

  const intervalId = setInterval(pollServer, 1000);
  pollServer(); // Initial poll
  
  return () => clearInterval(intervalId);
}, [audioContext, isPlaying, serverState]); // Added serverState to the dependency array
  
  // Handle play state changes
  const handlePlayStateChange = (newIsPlaying) => {
    console.log(`Bass page setting isPlaying to ${newIsPlaying}`);
    setIsPlaying(newIsPlaying);
    
    fetch('http://localhost:8080/api/voice/bass/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying: newIsPlaying })
    })
    .then(response => response.json())
    .then(data => console.log('Server response:', data))
    .catch(err => console.error('Error updating server:', err));
  };

  return (
    <div className="bass-page">
      <h1>Bass Voice Module</h1>
      <div className="connection-status">
        {isConnected ? 'Connected to server' : 'Disconnected from server'}
      </div>
      
      <VoiceModule
        ref={voiceModuleRef}
        voiceType="bass"
        sharedAudioContext={audioContext}
        onPlayStateChange={handlePlayStateChange}
        onSoloToggle={() => {}}
        isSoloMode={false}
        isCurrentSolo={false}
        soloVoice={null}
      />
    </div>

    
  );
}

export default BassPage;