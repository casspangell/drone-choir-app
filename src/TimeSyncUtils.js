// TimeSyncUtils.js
// Utility functions for time synchronization between clients

let serverTimeOffset = 0;
let syncCalls = 0;
let syncAccuracy = 0;

/**
 * Update the server time offset based on new data
 * @param {number} serverTime - Server's timestamp
 * @param {number} receivedAt - Client timestamp when message was received
 * @param {number} estimatedLatency - Estimated network latency
 */
export function updateServerTimeOffset(serverTime, receivedAt, estimatedLatency = 50) {
  const newOffset = serverTime - receivedAt + estimatedLatency;
  
  // Apply more weight to more recent measurements, but maintain stability
  if (syncCalls === 0) {
    // First sync call, just use the raw value
    serverTimeOffset = newOffset;
  } else {
    // Subsequent calls use a weighted average, with more weight to the existing value
    // as we get more samples (for stability)
    const weight = Math.min(0.3, 1 / (syncCalls + 1));
    serverTimeOffset = serverTimeOffset * (1 - weight) + newOffset * weight;
  }
  
  syncCalls++;
  
  // Calculate accuracy metric (absolute difference from previous value)
  syncAccuracy = Math.abs(serverTimeOffset - newOffset);
  
  return {
    offset: serverTimeOffset,
    accuracy: syncAccuracy,
    calls: syncCalls
  };
}

/**
 * Convert a server timestamp to local client time
 * @param {number} serverTime - Server's timestamp
 * @returns {number} - Equivalent client time
 */
export function serverToLocalTime(serverTime) {
  return serverTime - serverTimeOffset;
}

/**
 * Convert a local timestamp to server time
 * @param {number} localTime - Client's timestamp
 * @returns {number} - Equivalent server time
 */
export function localToServerTime(localTime) {
  return localTime + serverTimeOffset;
}

/**
 * Schedule a function to run at a specific server time
 * @param {Function} callback - Function to execute
 * @param {number} serverTime - Server timestamp when to execute the function
 * @returns {number} - Timeout ID
 */
export function scheduleAtServerTime(callback, serverTime) {
  const localTime = serverToLocalTime(serverTime);
  const now = Date.now();
  const delay = Math.max(0, localTime - now);
  
  console.log(`Scheduling function to run in ${delay}ms (server time: ${new Date(serverTime).toISOString()})`);
  
  return setTimeout(callback, delay);
}

/**
 * Get the current estimated server time
 * @returns {number} - Current server timestamp
 */
export function getEstimatedServerTime() {
  return localToServerTime(Date.now());
}

/**
 * Get information about the synchronization status
 * @returns {Object} - Sync status
 */
export function getSyncStatus() {
  return {
    offset: serverTimeOffset,
    accuracy: syncAccuracy,
    calls: syncCalls,
    synced: syncCalls > 0
  };
}

export default {
  updateServerTimeOffset,
  serverToLocalTime,
  localToServerTime,
  scheduleAtServerTime,
  getEstimatedServerTime,
  getSyncStatus
};