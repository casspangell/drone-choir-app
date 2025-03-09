// streamingConfig.js
export const STREAMING_CONFIG = {
    SERVER_URL: process.env.REACT_APP_STREAMING_SERVER || 'ws://localhost:8080',
    RECONNECT_INTERVAL: 5000,
    MAX_RECONNECT_ATTEMPTS: 5
};

export default STREAMING_CONFIG;