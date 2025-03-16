import { useState, useEffect, useRef, useCallback } from 'react';
// Import using ES Modules syntax
import FrequencyStreamClient from './FrequencyStreamClient';

const useFrequencyStreaming = (options = {}) => {
    // Streaming client reference
    const clientRef = useRef(null);

    // Streaming state
    const [isConnected, setIsConnected] = useState(false);
    const [frequencies, setFrequencies] = useState([]);
    const [streamingFrequencies, setStreamingFrequencies] = useState([]);
    const [voiceStates, setVoiceStates] = useState({});
    const [error, setError] = useState(null);
    const [isMaster, setIsMaster] = useState(false);

    // Memoized control methods
    const startFrequencyStream = useCallback((frequencyId) => {
        if (clientRef.current) {
            clientRef.current.startFrequencyStream(frequencyId);
        }
    }, []);

    const stopFrequencyStream = useCallback((frequencyId) => {
        if (clientRef.current) {
            clientRef.current.stopFrequencyStream(frequencyId);
        }
    }, []);

    const stopAllStreams = useCallback(() => {
        if (clientRef.current) {
            streamingFrequencies.forEach(freq => 
                clientRef.current.stopFrequencyStream(freq.id)
            );
        }
    }, [streamingFrequencies]);

    const updateNotes = useCallback((voiceType, notes) => {
        // Only allow master to update notes
        if (!isMaster) {
            console.log(`Cannot update notes in slave mode for ${voiceType}`);
            return;
        }
        
        if (clientRef.current) {
            clientRef.current.updateNotes(voiceType, notes);
        }
    }, [isMaster]);

    // Add method to check master status
    const checkMasterStatus = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.checkMasterStatus();
        }
    }, []);

    // Initialize streaming client on mount
    useEffect(() => {
        let isActive = true; // For cleanup to prevent state updates after unmount

        try {
            // Only create a new client if one doesn't exist
            if (!clientRef.current) {
                console.log("Creating new FrequencyStreamClient...");
                clientRef.current = new FrequencyStreamClient(options.serverUrl || 'ws://localhost:8080');
                const client = clientRef.current;
                console.log("FrequencyStreamClient created successfully:", client);

                const handleConnect = () => {
                    if (!isActive) return;
                    console.log("WebSocket connected!");
                    setIsConnected(true);
                    setError(null);
                    // Check master status on connect
                    setTimeout(() => {
                        if (client && isActive) {
                            client.checkMasterStatus();
                        }
                    }, 500);
                };

                const handleDisconnect = () => {
                    if (!isActive) return;
                    console.log("WebSocket disconnected");
                    setIsConnected(false);
                    setIsMaster(false);
                };

                const handleError = (err) => {
                    if (!isActive) return;
                    console.error("WebSocket error:", err);
                    setError(err);
                    setIsConnected(false);
                };

                const handleStreamStart = (frequency) => {
                    if (!isActive) return;
                    setStreamingFrequencies(prev => 
                        prev.some(f => f.id === frequency.id) 
                            ? prev 
                            : [...prev, frequency]
                    );
                };

                const handleStreamStop = (frequencyId) => {
                    if (!isActive) return;
                    setStreamingFrequencies(prev => 
                        prev.filter(f => f.id !== frequencyId)
                    );
                };

                const handleVoiceStateUpdate = (voiceType, state) => {
                    if (!isActive) return;
                    setVoiceStates(prev => ({
                        ...prev,
                        [voiceType]: state
                    }));
                };

                const handleMasterChanged = (newIsMaster) => {
                    if (!isActive) return;
                    console.log(`Master status changed: ${newIsMaster ? 'MASTER' : 'SLAVE'}`);
                    setIsMaster(newIsMaster);
                };

                client
                    .on('connect', handleConnect)
                    .on('disconnect', handleDisconnect)
                    .on('error', handleError)
                    .on('streamStart', handleStreamStart)
                    .on('streamStop', handleStreamStop)
                    .on('voiceStateUpdate', handleVoiceStateUpdate)
                    .on('masterChanged', handleMasterChanged);

                // Connect only once
                client.connect();
            }
        } catch (err) {
            if (isActive) {
                console.error("Error initializing FrequencyStreamClient:", err);
                setError(err);
            }
        }

        // Cleanup on unmount or when serverUrl changes
        return () => {
            isActive = false;
            if (clientRef.current) {
                clientRef.current.disconnect();
                clientRef.current = null;
            }
        };
    }, [options.serverUrl]);

    // Re-check master status periodically to ensure UI is in sync
    useEffect(() => {
        if (isConnected) {
            const checkInterval = setInterval(() => {
                checkMasterStatus();
            }, 10000); // Check every 10 seconds
            
            return () => clearInterval(checkInterval);
        }
    }, [isConnected, checkMasterStatus]);

    return {
        // Connection state
        isConnected,
        error,
        isMaster,

        // Frequency information
        frequencies,
        streamingFrequencies,
        voiceStates,

        // Control methods
        startFrequencyStream,
        stopFrequencyStream,
        stopAllStreams,
        updateNotes,
        checkMasterStatus
    };
};

export default useFrequencyStreaming;