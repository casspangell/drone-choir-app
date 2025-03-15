// src/AltoPage.js
import React, { useState, useEffect, useRef } from 'react';
import VoiceModule from './VoiceModule';
import { VOICE_RANGES } from './voiceTypes';

function AltoPage() {
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
  
  // Set up polling to the server
  useEffect(() => {
    const pollServer = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/voice/alto');
        if (response.ok) {
          const data = await response.json();
          console.log('ALTO PAGE received full server data:', data);
          setServerState(data);
          setIsConnected(true);
          
          // Sync with server if needed
          if (voiceModuleRef.current) {
            // Handle play state
            if (data.isPlaying && !isPlaying) {
              voiceModuleRef.current.startPerformance(audioContext);
              setIsPlaying(true);
            } else if (!data.isPlaying && isPlaying) {
              voiceModuleRef.current.stopPerformance();
              setIsPlaying(false);
            }
            
            // Handle note queue
            if (data.noteQueue && data.noteQueue.length > 0) {
              console.log('ALTO PAGE applying queue:', data.noteQueue?.map(note => ({
                note: note.note,
                frequency: note.frequency.toFixed(2),
                duration: note.duration?.toFixed(2)
              })));
              
              voiceModuleRef.current.clearQueue();
              data.noteQueue.forEach(note => {
                voiceModuleRef.current.addSpecificNote(note);
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching alto state:', error);
        setIsConnected(false);
      }
    };

    const intervalId = setInterval(pollServer, 1000);
    pollServer(); // Initial poll
    
    return () => clearInterval(intervalId);
  }, [audioContext, isPlaying]);
  
  // Handle play state changes
  const handlePlayStateChange = (newIsPlaying) => {
    setIsPlaying(newIsPlaying);
    
    fetch('http://localhost:8080/api/voice/alto/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying: newIsPlaying })
    }).catch(err => console.error('Error updating server:', err));
  };

  return (
    <div className="alto-page">
      <h1>Alto Voice Module</h1>
      <div className="connection-status">
        {isConnected ? 'Connected to server' : 'Disconnected from server'}
      </div>
      
      <VoiceModule
        ref={voiceModuleRef}
        voiceType="alto"
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

export default AltoPage;