import { useState, useEffect, useRef, useCallback } from 'react';
import FrequencyStreamClient from './FrequencyStreamClient';

const useFrequencyStreaming = (options = {}) => {
    // Streaming client reference
    const clientRef = useRef(null);

    // Streaming state
    const [isConnected, setIsConnected] = useState(false);
    const [frequencies] = useState([]);
    const [streamingFrequencies, setStreamingFrequencies] = useState([]);
    const [error, setError] = useState(null);

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

    // Initialize streaming client on mount
    useEffect(() => {
        // Create streaming client
        clientRef.current = new FrequencyStreamClient(options.serverUrl);

        // Set up event listeners
        const client = clientRef.current;

        const handleConnect = () => {
            setIsConnected(true);
            setError(null);
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        const handleError = (err) => {
            setError(err);
            setIsConnected(false);
        };

        const handleStreamStart = (frequency) => {
            setStreamingFrequencies(prev => 
                prev.some(f => f.id === frequency.id) 
                    ? prev 
                    : [...prev, frequency]
            );
        };

        const handleStreamStop = (frequencyId) => {
            setStreamingFrequencies(prev => 
                prev.filter(f => f.id !== frequencyId)
            );
        };

        client
            .on('connect', handleConnect)
            .on('disconnect', handleDisconnect)
            .on('error', handleError)
            .on('streamStart', handleStreamStart)
            .on('streamStop', handleStreamStop)
            .connect();

        // Cleanup on unmount
        return () => {
            client.disconnect();
        };
    }, [options.serverUrl]);

    return {
        // Connection state
        isConnected,
        error,

        // Frequency information
        frequencies,
        streamingFrequencies,

        // Control methods
        startFrequencyStream,
        stopFrequencyStream,
        stopAllStreams
    };
};

export default useFrequencyStreaming;