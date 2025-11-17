/*-----------------------------------------------------------------
* File: webRTC.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: WebRTC utility functions for peer-to-peer audio/video calls
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/

/**
 * WebRTC configuration for STUN/TURN servers
 */
export const rtcConfig = {
  iceServers: [
    // Google's public STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    
    // Fallback STUN servers
    { urls: "stun:stun.stunprotocol.org:3478" },
    { urls: "stun:stun.voip.blackberry.com:3478" },
    
    // Add your TURN servers here for production
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
};

/**
 * Creates and returns a new WebRTC peer connection
 * @param {Object} config - Custom configuration (optional)
 * @returns {RTCPeerConnection}
 */
export const createPeerConnection = (config = {}) => {
  try {
    const finalConfig = { ...rtcConfig, ...config };
    return new RTCPeerConnection(finalConfig);
  } catch (error) {
    console.error("Error creating peer connection:", error);
    throw new Error(`Failed to create peer connection: ${error.message}`);
  }
};

/**
 * Get local media stream (audio and/or video)
 * @param {boolean} audio - Whether to include audio
 * @param {boolean} video - Whether to include video
 * @param {Object} videoConstraints - Custom video constraints
 * @returns {Promise<MediaStream>}
 */
export const getLocalStream = async (
  audio = true, 
  video = false, 
  videoConstraints = {}
) => {
  try {
    const constraints = {
      audio: audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16
      } : false,
      
      video: video ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: "user",
        ...videoConstraints
      } : false,
    };
    
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error("Error getting local stream:", error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to access camera/microphone';
    
    switch (error.name) {
      case 'NotAllowedError':
        userMessage = 'Camera/microphone access was denied. Please allow access and try again.';
        break;
      case 'NotFoundError':
        userMessage = 'No camera/microphone found. Please check your device.';
        break;
      case 'NotReadableError':
        userMessage = 'Camera/microphone is already in use by another application.';
        break;
      case 'OverconstrainedError':
        userMessage = 'Camera does not support the requested constraints.';
        break;
      default:
        userMessage = `Unable to access media devices: ${error.message}`;
    }
    
    throw new Error(userMessage);
  }
};

/**
 * Get screen sharing stream
 * @param {boolean} audio - Whether to include system audio
 * @returns {Promise<MediaStream>}
 */
export const getScreenShareStream = async (audio = false) => {
  try {
    const constraints = {
      video: {
        cursor: 'always',
        displaySurface: 'window'
      },
      audio: audio ? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: true
      } : false
    };
    
    return await navigator.mediaDevices.getDisplayMedia(constraints);
  } catch (error) {
    console.error("Error getting screen share stream:", error);
    
    let userMessage = 'Failed to start screen sharing';
    if (error.name === 'NotAllowedError') {
      userMessage = 'Screen sharing was denied. Please allow access to share your screen.';
    }
    
    throw new Error(userMessage);
  }
};

/**
 * Add tracks from media stream to peer connection
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {MediaStream} stream - The media stream
 */
export const addTracksToConnection = (peerConnection, stream) => {
  if (!peerConnection || !stream) {
    console.warn('Peer connection or stream is null');
    return;
  }
  
  try {
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    console.log(`Added ${stream.getTracks().length} tracks to peer connection`);
  } catch (error) {
    console.error('Error adding tracks to connection:', error);
    throw error;
  }
};

/**
 * Replace a specific track in the peer connection
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {string} kind - Track kind ('audio' or 'video')
 * @param {MediaStreamTrack} newTrack - The new track to add
 * @returns {Promise<boolean>} - Success status
 */
export const replaceTrack = async (peerConnection, kind, newTrack) => {
  try {
    const senders = peerConnection.getSenders();
    const sender = senders.find(s => 
      s.track && s.track.kind === kind
    );
    
    if (sender) {
      await sender.replaceTrack(newTrack);
      console.log(`Replaced ${kind} track successfully`);
      return true;
    } else {
      console.warn(`No ${kind} sender found to replace`);
      return false;
    }
  } catch (error) {
    console.error(`Error replacing ${kind} track:`, error);
    throw error;
  }
};

/**
 * Create an offer to initiate a call
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {Object} options - Offer options
 * @returns {Promise<RTCSessionDescriptionInit>}
 */
export const createOffer = async (peerConnection, options = {}) => {
  try {
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      ...options
    };
    
    const offer = await peerConnection.createOffer(offerOptions);
    await peerConnection.setLocalDescription(offer);
    
    console.log('Created offer successfully');
    return offer;
  } catch (error) {
    console.error("Error creating offer:", error);
    throw new Error(`Failed to create offer: ${error.message}`);
  }
};

/**
 * Create an answer to respond to an offer
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {Object} options - Answer options
 * @returns {Promise<RTCSessionDescriptionInit>}
 */
export const createAnswer = async (peerConnection, options = {}) => {
  try {
    const answerOptions = {
      ...options
    };
    
    const answer = await peerConnection.createAnswer(answerOptions);
    await peerConnection.setLocalDescription(answer);
    
    console.log('Created answer successfully');
    return answer;
  } catch (error) {
    console.error("Error creating answer:", error);
    throw new Error(`Failed to create answer: ${error.message}`);
  }
};

/**
 * Set the remote description for a peer connection
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {RTCSessionDescriptionInit} description - The remote description
 */
export const setRemoteDescription = async (peerConnection, description) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    console.log('Set remote description successfully');
  } catch (error) {
    console.error("Error setting remote description:", error);
    throw new Error(`Failed to set remote description: ${error.message}`);
  }
};

/**
 * Add an ICE candidate to the peer connection
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {RTCIceCandidateInit} candidate - The ICE candidate
 */
export const addIceCandidate = async (peerConnection, candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('Added ICE candidate successfully');
  } catch (error) {
    // Don't throw for failed ICE candidates - they're often non-fatal
    console.warn("Error adding ICE candidate (non-fatal):", error);
  }
};

/**
 * Get connection statistics
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @returns {Promise<Object>} - Connection statistics
 */
export const getConnectionStats = async (peerConnection) => {
  try {
    const stats = await peerConnection.getStats();
    const result = {};
    
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
        result[report.type] = {
          kind: report.kind,
          packetsLost: report.packetsLost,
          packetsReceived: report.packetsReceived,
          packetsSent: report.packetsSent,
          bytesReceived: report.bytesReceived,
          bytesSent: report.bytesSent,
          jitter: report.jitter,
          roundTripTime: report.roundTripTime,
          timestamp: report.timestamp
        };
      } else if (report.type === 'candidate-pair' && report.nominated) {
        result.candidatePair = {
          state: report.state,
          priority: report.priority,
          nominated: report.nominated,
          writable: report.writable,
          readable: report.readable,
          bytesSent: report.bytesSent,
          bytesReceived: report.bytesReceived
        };
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error getting connection stats:', error);
    return null;
  }
};

/**
 * Check if WebRTC is supported in the current browser
 * @returns {boolean} - True if WebRTC is supported
 */
export const isWebRTCSupported = () => {
  return !!(
    typeof window !== 'undefined' &&
    window.RTCPeerConnection &&
    window.RTCSessionDescription &&
    window.RTCIceCandidate &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
};

/**
 * Get available media devices
 * @returns {Promise<MediaDeviceInfo[]>} - List of media devices
 */
export const getMediaDevices = async () => {
  try {
    // Need to get user media first to ensure permission for device enumeration
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices;
  } catch (error) {
    console.error('Error getting media devices:', error);
    return [];
  }
};

/**
 * Handle ending a call and cleaning up resources
 * @param {RTCPeerConnection} peerConnection - The peer connection
 * @param {MediaStream} localStream - The local media stream
 * @param {MediaStream} screenStream - The screen share stream (optional)
 */
export const endCall = (peerConnection, localStream = null, screenStream = null) => {
  console.log('Cleaning up call resources...');
  
  // Stop all tracks in the local stream
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
  }
  
  // Stop all tracks in the screen share stream
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      track.stop();
    });
  }
  
  // Close and cleanup the peer connection
  if (peerConnection) {
    // Remove all event listeners
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onsignalingstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.onnegotiationneeded = null;
    peerConnection.onconnectionstatechange = null;
    
    // Close the connection
    peerConnection.close();
  }
  
  console.log('Call resources cleaned up successfully');
};

/**
 * Set audio output device for a video element
 * @param {HTMLVideoElement} videoElement - The video element
 * @param {string} deviceId - The audio output device ID
 * @returns {Promise<boolean>} - Success status
 */
export const setAudioOutput = async (videoElement, deviceId) => {
  try {
    if (videoElement.setSinkId) {
      await videoElement.setSinkId(deviceId);
      console.log('Audio output device set successfully');
      return true;
    } else {
      console.warn('setSinkId is not supported in this browser');
      return false;
    }
  } catch (error) {
    console.error('Error setting audio output device:', error);
    return false;
  }
};