import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useSocket } from './SocketContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { stompClient, isConnected, subscribe, unsubscribe, sendMessage } = useSocket();
  const { user } = useAuth();
  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const [callType, setCallType] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isMakingCall, setIsMakingCall] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallServiceAvailable, setIsCallServiceAvailable] = useState(true);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef();
  const callTimerRef = useRef();
  const subscriptionsRef = useRef(new Set());

  // STOMP message sender
  const sendCallMessage = useCallback((destination, payload) => {
    sendMessage(`/call.${destination}`, payload);
  }, [sendMessage]);

  const sendCallSignal = useCallback((targetUserID, signal, callID) => {
    if (!targetUserID) {
      console.warn('Cannot send signal: targetUserID is undefined');
      return;
    }
    sendMessage('/call.signal', {
      fromUserID: Number(user.userID),
      toUserID: Number(targetUserID),
      signal,
      callID,
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // Check for active call on load
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const { hasActiveCall, call } = await callService.getActiveCall();
        if (hasActiveCall) {
          setCall(call);
          setCallStatus('ongoing');
          setCallType(call.Type);
          await setupMediaAndConnection({ callID: call.CallID });
        }
        setIsCallServiceAvailable(true);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Call service unavailable:', error.message || 'Unknown error');
        }

        if (error.response?.status === 404 || 
            error.message?.includes('404') || 
            error.message?.includes('not found')) {
          setIsCallServiceAvailable(false);
        }
        
        if (error.response?.status !== 404) {
          // Uncomment if you want to show an error toast
          // toast.error('Could not connect to call service');
        }
      }
    };

    if (isCallServiceAvailable) {
      checkActiveCall();
    }
    
    return () => {
      stopMediaTracks();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallServiceAvailable]);

  // STOMP event listeners for call handling
  useEffect(() => {
    if (!isConnected || !isCallServiceAvailable) return;

    console.log('Setting up STOMP call subscriptions');

    // Subscribe to call events
    const subscriptions = [
      // Incoming call handler
      subscribe('/user/queue/call.incoming', (data) => {
        console.log('Incoming call via STOMP:', data);
        setCall(data);
        setCallType(data.type);
        setCallStatus('ringing');
        setIsReceivingCall(true);
      }),

      // Call answered handler
      subscribe('/user/queue/call.answered', (data) => {
        console.log('Call answered via STOMP:', data);
        setCallStatus('ongoing');
        startCallTimer();
      }),

      // Call ended handler
      subscribe('/user/queue/call.ended', (data) => {
        console.log('Call ended via STOMP:', data);
        toast.success(`Call ended. Duration: ${formatCallDuration(data.duration)}`);
        endCallCleanup();
      }),

      // Call rejected handler
      subscribe('/user/queue/call.rejected', (data) => {
        console.log('Call rejected via STOMP:', data);
        toast.error('Call was rejected');
        endCallCleanup();
      }),

      // WebRTC signaling handler
      subscribe('/user/queue/call.signal', (data) => {
        console.log('Received signaling data via STOMP:', data);
        handleSignalingData(data);
      }),

      // Call error handler
      subscribe('/user/queue/call.error', (data) => {
        console.error('Call error via STOMP:', data);
        toast.error(data.message || 'Call error occurred');
      })
    ];

    // Store subscription references
    subscriptions.forEach(sub => {
      if (sub) subscriptionsRef.current.add(sub);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up STOMP call subscriptions');
      subscriptionsRef.current.forEach(sub => {
        try {
          unsubscribe(sub.destination);
        } catch (e) {
          console.warn('Error unsubscribing:', e);
        }
      });
      subscriptionsRef.current.clear();
    };
  }, [isConnected, isCallServiceAvailable, subscribe, unsubscribe]);

  // WebRTC signaling handler với STOMP
  const handleSignalingData = async (data) => {
    try {
      console.log('Processing STOMP signaling data:', data.signal?.type, data);
      
      if (!peerConnectionRef.current) {
        console.log('Setting up new peer connection for incoming call/signal');
        await setupMediaAndConnection({ 
          isReceivingCall: true, 
          fromUserID: data.fromUserID
        });
      }
      
      const { type, sdp, candidate } = data.signal;
      
      if (type === 'offer') {
        console.log('Setting remote description (offer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        console.log('Creating answer');
        const answer = await peerConnectionRef.current.createAnswer();
        console.log('Setting local description (answer)');
        await peerConnectionRef.current.setLocalDescription(answer);
        
        console.log('Sending answer to:', data.fromUserID);
        sendCallSignal(data.fromUserID, {
          type: 'answer',
          sdp: peerConnectionRef.current.localDescription.sdp
        }, data.callID);
      } else if (type === 'answer') {
        console.log('Setting remote description (answer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        console.log('Connection should be establishing now');
      } else if (type === 'candidate') {
        try {
          console.log('Adding ICE candidate');
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error adding received ice candidate', err);
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error handling signaling data:', error);
      }
      toast.error('Failed to establish connection');
    }
  };

  // Set up media streams and peer connection
  const setupMediaAndConnection = async ({ callID, isReceivingCall, fromUserID }) => {
    try {
      // ✅ FIX: Đảm bảo callType được set trước khi getUserMedia
      const currentCallType = callType || 'video';
      const constraints = {
        audio: true,
        video: currentCallType === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle'
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        console.log('Got remote track:', event.streams[0]);
        setRemoteStream(event.streams[0]);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Generated new ICE candidate:', event.candidate.candidate);
          
          // ✅ FIX: Đảm bảo targetUserID không bị undefined
          const targetID = fromUserID || call?.initiatorID || call?.receiverID;
          if (targetID) {
            sendCallSignal(targetID, {
              type: 'candidate',
              candidate: event.candidate
            }, callID);
          } else {
            console.warn('Cannot send ICE candidate: targetUserID is undefined');
          }
        } else {
          console.log('ICE candidate generation complete');
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state change:', peerConnection.iceConnectionState);
      };
      
      peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state change:', peerConnection.iceGatheringState);
      };

      if (!isReceivingCall) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // ✅ FIX: Đảm bảo targetUserID không bị undefined
        const targetID = fromUserID || call?.receiverID;
        if (targetID) {
          sendCallSignal(targetID, {
            type: 'offer',
            sdp: peerConnection.localDescription.sdp
          }, callID);
        } else {
          console.warn('Cannot send offer: targetUserID is undefined');
        }
      }

      // Join call room via STOMP
      if (callID) {
        sendCallMessage('join', { callID });
      }

      peerConnection.onconnectionstatechange = (event) => {
        console.log('Connection state change:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed') {
          toast.error('Call connection lost');
          endCall();
        }
      };

      return peerConnection;
    } catch (error) {
      console.error('Error setting up media and connection:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow camera and microphone access');
      } else {
        toast.error('Failed to setup call: ' + error.message);
      }
      
      throw error;
    }
  };

  // Start call timer
  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Format call duration
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up call resources
  const endCallCleanup = () => {
    setCall(null);
    setCallStatus(null);
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    setCallDuration(0);
    
    stopMediaTracks();
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Stop all media tracks
  const stopMediaTracks = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
    if (remoteStream) {
      setRemoteStream(null);
    }
  };

  // API: Initiate a call via STOMP
  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    try {
      // ✅ FIX: Validate type và set callType trước
      const validatedType = type === 'audio' ? 'audio' : 'video';
      setIsMakingCall(true);
      setCallType(validatedType);
      
      const response = await callService.initiateCall(receiverID, conversationID, validatedType);
      const callData = response.call || response;
      
      setCall(callData);
      setCallStatus('ringing');
      
      // ✅ FIX: Đảm bảo field names khớp với backend
      sendCallMessage('initiate', {
        fromUserID: Number(user.userID),
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: validatedType,
        conversationID: Number(conversationID)
      });
      
      await setupMediaAndConnection({ 
        callID: callData.callID,
        isReceivingCall: false,
        fromUserID: receiverID // ✅ THÊM fromUserID
      });
      
      return callData;
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Failed to initiate call');
      endCallCleanup();
      throw error;
    } finally {
      setIsMakingCall(false);
    }
  };

  // API: Answer an incoming call via STOMP
  const answerCall = async () => {
    try {
      if (!call) return;
      
      const response = await callService.answerCall(call.callID);
      setCallStatus('ongoing');
      setIsReceivingCall(false);
      
      // ✅ FIX: Đảm bảo field names khớp
      sendCallMessage('answer', {
        fromUserID: Number(user.userID),
        callID: Number(call.callID),
        initiatorID: Number(call.initiatorID),
        accepted: true
      });
      
      await setupMediaAndConnection({ 
        callID: call.callID,
        isReceivingCall: true,
        fromUserID: call.initiatorID // ✅ THÊM fromUserID
      });
      
      startCallTimer();
      
      return response;
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error(error.message || 'Failed to answer call');
      endCallCleanup();
      throw error;
    }
  };

  // API: End an active call via STOMP
  const endCall = async () => {
    try {
      if (!call) return;
      
      await callService.endCall(call.callID);
      
      // Send via STOMP
      sendCallMessage('end', {
        callID: Number(call.callID),
        fromUserID: Number(user.userID),
        duration: callDuration
      });
      
      sendCallMessage('leave', { callID: Number(call.callID), fromUserID: Number(user.userID) });
      
      endCallCleanup();
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error(error.message || 'Failed to end call');
      endCallCleanup();
      throw error;
    }
  };

  // API: Reject an incoming call via STOMP
  const rejectCall = async () => {
    try {
      if (!call) return;
      
      await callService.rejectCall(call.callID);
      
      // Send via STOMP
      sendCallMessage('reject', {
        callID: Number(call.callID),
        fromUserID: Number(user.userID)
      });
      
      endCallCleanup();
    } catch (error) {
      console.error('Error rejecting call:', error);
      toast.error(error.message || 'Failed to reject call');
      endCallCleanup();
      throw error;
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const enabled = !isAudioEnabled;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      setIsAudioEnabled(enabled);
      
      // Notify other participants via STOMP
      if (call) {
        sendCallMessage('media.toggle', {
          callID: Number(call.callID),
          type: 'audio',
          enabled
        });
      }
      
      return enabled;
    }
    return isAudioEnabled;
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const enabled = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      setIsVideoEnabled(enabled);
      
      // Notify other participants via STOMP
      if (call) {
        sendCallMessage('media.toggle', {
          callID: Number(call.callID),
          type: 'video',
          enabled
        });
      }
      
      return enabled;
    }
    return isVideoEnabled;
  };

  // Load call history
  const loadCallHistory = async (limit = 10, offset = 0) => {
    try {
      const response = await callService.getCallHistory(limit, offset);
      setCallHistory(response.calls);
      return response.calls;
    } catch (error) {
      console.error('Error loading call history:', error);
      toast.error(error.message || 'Failed to load call history');
      throw error;
    }
  };

  const value = {
    call,
    callStatus,
    callType,
    isReceivingCall,
    isMakingCall,
    callHistory,
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    toggleAudio,
    toggleVideo,
    loadCallHistory,
    formatCallDuration
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);