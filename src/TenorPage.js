// src/TenorPage.js
import React, { useState, useEffect, useRef } from 'react';
import VoiceModule from './VoiceModule';
import { VOICE_RANGES } from './voiceTypes';

function TenorPage() {
  const voiceModuleRef = useRef(null);
  const [serverState, setServerState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Set up polling to the server
  useEffect(() => {
    const pollServer = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/voice/tenor');
        if (response.ok) {
          const data = await response.json();
          setServerState(data);
          setIsConnected(true);
          
          // Sync with server state if needed
          if (voiceModuleRef.current) {
            if (data.isPlaying && !voiceModuleRef.current.isPlaying) {
              voiceModuleRef.current.startPerformance();
            } else if (!data.isPlaying && voiceModuleRef.current.isPlaying) {
              voiceModuleRef.current.stopPerformance();
            }
          }
        }
      } catch (error) {
        console.error('Error connecting to server:', error);
        setIsConnected(false);
      }
    };
    
    // Poll every second
    const intervalId = setInterval(pollServer, 1000);
    pollServer(); // Initial poll
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Handle play state changes
  const handlePlayStateChange = (isPlaying) => {
    fetch('http://localhost:8080/api/voice/tenor/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying })
    }).catch(err => console.error('Error updating server:', err));
  };

  return (
    <div className="tenor-page">
      <h1>Tenor Voice Module</h1>
      <div className="connection-status">
        {isConnected ? 'Connected to server' : 'Disconnected from server'}
      </div>
      
      <VoiceModule
        ref={voiceModuleRef}
        voiceType="tenor"
        onPlayStateChange={handlePlayStateChange}
      />
    </div>
  );
}

export default TenorPage;