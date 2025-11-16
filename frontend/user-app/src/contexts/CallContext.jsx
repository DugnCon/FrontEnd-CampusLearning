/*-----------------------------------------------------------------
* File: CallContext.jsx (STOMP Version - PascalCase)
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Call context using STOMP protocol with PascalCase fields
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { stompClient, isConnected, user } = useSocket();
  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null); // 'ringing', 'ongoing', 'ended'
  const [callType, setCallType] = useState(null); // 'audio', 'video'
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
  const subscriptionsRef = useRef([]);

  // STOMP send helper
  const sendViaStomp = (destination, body) => {
    if (stompClient && isConnected) {
      console.log('🟢 Sending via STOMP:', destination, body);
      stompClient.send(destination, {}, JSON.stringify(body));
      return true;
    } else {
      console.error('🔴 STOMP not connected, cannot send:', destination);
      return false;
    }
  };

  // Check for active call on load
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const { hasActiveCall, call } = await callService.getActiveCall();
        if (hasActiveCall) {
          setCall(call);
          setCallStatus('ongoing');
          setCallType(call.type || 'video');
          await setupMediaAndConnection({ callID: call.callID });
        }
        setIsCallServiceAvailable(true);
      } catch (error) {
        console.warn('Call service unavailable:', error.message);
        if (error.response?.status === 404 || error.message?.includes('404')) {
          setIsCallServiceAvailable(false);
        }
      }
    };

    if (user && isCallServiceAvailable) {
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
      // Cleanup subscriptions
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    };
  }, [user, isCallServiceAvailable]);

  // STOMP event listeners for call handling
  useEffect(() => {
    if (!stompClient || !isConnected || !isCallServiceAvailable) {
      console.log('STOMP not ready for call listeners');
      return;
    }

    console.log('🔔 Setting up STOMP call listeners');

    // Cleanup previous subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to call topics
    const subscriptions = [
      {
        topic: `/user/topic/call.incoming`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('📞 Incoming call via STOMP:', data);
            setCall(data.call || data);
            setCallType(data.type || 'video');
            setCallStatus('ringing');
            setIsReceivingCall(true);
            
            // Auto-setup media for incoming call
            setupMediaAndConnection({ 
              isReceivingCall: true, 
              fromUserID: data.initiatorID 
            });
          } catch (error) {
            console.error('Error parsing incoming call:', error);
          }
        }
      },
      {
        topic: `/user/topic/call.answered`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('✅ Call answered via STOMP:', data);
            setCallStatus('ongoing');
            setIsReceivingCall(false);
            startCallTimer();
          } catch (error) {
            console.error('Error parsing call answered:', error);
          }
        }
      },
      {
        topic: `/user/topic/call.ended`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('📵 Call ended via STOMP:', data);
            toast.success(`Call ended. Duration: ${formatCallDuration(data.duration || callDuration)}`);
            endCallCleanup();
          } catch (error) {
            console.error('Error parsing call ended:', error);
          }
        }
      },
      {
        topic: `/user/topic/call.rejected`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('❌ Call rejected via STOMP:', data);
            toast.error('Call was rejected');
            endCallCleanup();
          } catch (error) {
            console.error('Error parsing call rejected:', error);
          }
        }
      },
      {
        topic: `/user/topic/call.signal`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('📡 Received signaling data via STOMP:', data.signal?.type);
            handleSignalingData(data);
          } catch (error) {
            console.error('Error parsing signaling data:', error);
          }
        }
      },
      {
        topic: `/user/topic/call.error`,
        handler: (message) => {
          try {
            const data = JSON.parse(message.body);
            console.error('🚨 Call error via STOMP:', data);
            toast.error(data.message || 'Call error occurred');
          } catch (error) {
            console.error('Error parsing call error:', error);
          }
        }
      }
    ];

    // Setup all subscriptions
    subscriptions.forEach(({ topic, handler }) => {
      const subscription = stompClient.subscribe(topic, handler);
      subscriptionsRef.current.push(subscription);
      console.log(`🔔 Subscribed to: ${topic}`);
    });

    // Cleanup subscriptions
    return () => {
      subscriptionsRef.current.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing:', error);
        }
      });
      subscriptionsRef.current = [];
    };
  }, [stompClient, isConnected, isCallServiceAvailable]);

  // WebRTC signaling handler - CORE RTC LOGIC
  const handleSignalingData = async (data) => {
    try {
      const { signal, fromUserID } = data;
      console.log('🔄 Handling signaling:', signal.type, 'from:', fromUserID);
      
      // Create peer connection if not exists
      if (!peerConnectionRef.current) {
        console.log('Creating new peer connection for signaling');
        await setupMediaAndConnection({ 
          isReceivingCall: true, 
          fromUserID: fromUserID 
        });
      }
      
      const peerConnection = peerConnectionRef.current;
      
      if (signal.type === 'offer') {
        console.log('📥 Setting remote description (offer)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        
        console.log('📤 Creating answer');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('🔄 Sending answer to:', fromUserID);
        sendViaStomp('/app/call.signal', {
          toUserID: fromUserID,
          signal: {
            type: 'answer',
            sdp: peerConnection.localDescription.sdp
          }
        });
        
      } else if (signal.type === 'answer') {
        console.log('📥 Setting remote description (answer)');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        console.log('✅ Peer connection established!');
        
      } else if (signal.type === 'candidate') {
        try {
          console.log('📥 Adding ICE candidate');
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      }
    } catch (error) {
      console.error('❌ Error handling signaling data:', error);
      toast.error('Failed to establish connection: ' + error.message);
    }
  };

  // Set up media streams and peer connection - PASCALCASE VERSION
  const setupMediaAndConnection = async ({ callID, isReceivingCall = false, fromUserID }) => {
    try {
      console.log('🎥 Setting up media and connection, video:', callType === 'video');
      
      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? {
          width: 1280,
          height: 720,
          frameRate: 30
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      // Set local video source
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection with better configuration
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('🎵 Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        console.log('🎬 Got remote track:', event.streams[0]);
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Send ICE candidates to the other peer via STOMP
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Generated ICE candidate:', event.candidate.type);
          
          sendViaStomp('/app/call.signal', {
            toUserID: fromUserID || call?.initiatorID || call?.receiverID,
            signal: {
              type: 'candidate',
              candidate: event.candidate
            }
          });
        } else {
          console.log('✅ ICE candidate generation complete');
        }
      };

      // Connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
          case 'connected':
            console.log('✅ Peer connection connected!');
            break;
          case 'disconnected':
          case 'failed':
            console.error('❌ Peer connection failed');
            toast.error('Call connection lost');
            endCall();
            break;
          case 'closed':
            console.log('📵 Peer connection closed');
            break;
        }
      };

      // Create and send offer if initiating the call
      if (!isReceivingCall) {
        console.log('🎯 Creating offer for call initiation');
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
        });
        await peerConnection.setLocalDescription(offer);
        
        console.log('🔄 Sending offer to:', fromUserID || call?.receiverID);
        sendViaStomp('/app/call.signal', {
          toUserID: fromUserID || call?.receiverID,
          signal: {
            type: 'offer',
            sdp: peerConnection.localDescription.sdp
          }
        });
      }

      // Join call room
      if (callID) {
        sendViaStomp('/app/call.join', { callID });
      }

      return peerConnection;
    } catch (error) {
      console.error('❌ Error setting up media and connection:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow camera and microphone access');
      } else if (error.name === 'NotFoundError') {
        toast.error('Camera or microphone not found');
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
    console.log('🧹 Cleaning up call resources');
    setCall(null);
    setCallStatus(null);
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    
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
    setRemoteStream(null);
  };

  // API: Initiate a call - PASCALCASE VERSION
  const initiateCall = async (receiverID, type = 'video') => {
    try {
      if (!stompClient || !isConnected) {
        throw new Error('STOMP connection not available');
      }

      setIsMakingCall(true);
      setCallType(type);
      
      const response = await callService.initiateCall(receiverID, type);
      const callData = response.call || response;
      
      setCall(callData);
      setCallStatus('ringing');
      
      // Send call initiation via STOMP
      sendViaStomp('/app/call.initiate', {
        receiverID: receiverID,
        type: type,
        callID: callData.callID || callData.id
      });
      
      // Setup media and WebRTC connection
      await setupMediaAndConnection({ 
        callID: callData.callID || callData.id,
        isReceivingCall: false,
        fromUserID: receiverID
      });
      
      return callData;
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      toast.error(error.message || 'Failed to initiate call');
      endCallCleanup();
      throw error;
    }
  };

  // API: Answer an incoming call - PASCALCASE VERSION
  const answerCall = async () => {
    try {
      if (!call) {
        throw new Error('No call to answer');
      }

      if (!stompClient || !isConnected) {
        throw new Error('STOMP connection not available');
      }
      
      const response = await callService.answerCall(call.callID || call.id);
      setCallStatus('ongoing');
      setIsReceivingCall(false);
      
      // Send answer via STOMP
      sendViaStomp('/app/call.answer', {
        callID: call.callID || call.id,
        answer: true
      });
      
      startCallTimer();
      
      return response;
    } catch (error) {
      console.error('❌ Error answering call:', error);
      toast.error(error.message || 'Failed to answer call');
      endCallCleanup();
      throw error;
    }
  };

  // API: End an active call - PASCALCASE VERSION
  const endCall = async () => {
    try {
      if (!call) return;

      // Send end call via STOMP
      sendViaStomp('/app/call.end', {
        callID: call.callID || call.id,
        duration: callDuration
      });
      
      // Leave call room
      sendViaStomp('/app/call.leave', { 
        callID: call.callID || call.id 
      });
      
      await callService.endCall(call.callID || call.id);
      
      endCallCleanup();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      toast.error(error.message || 'Failed to end call');
      endCallCleanup();
      throw error;
    }
  };

  // API: Reject an incoming call - PASCALCASE VERSION  
  const rejectCall = async () => {
    try {
      if (!call) return;

      // Send reject via STOMP
      sendViaStomp('/app/call.reject', {
        callID: call.callID || call.id
      });
      
      await callService.rejectCall(call.callID || call.id);
      
      endCallCleanup();
    } catch (error) {
      console.error('❌ Error rejecting call:', error);
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
        sendViaStomp('/app/call.media.toggle', {
          callID: call.callID || call.id,
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
        sendViaStomp('/app/call.media.toggle', {
          callID: call.callID || call.id,
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
      setCallHistory(response.calls || response);
      return response.calls || response;
    } catch (error) {
      console.error('Error loading call history:', error);
      toast.error(error.message || 'Failed to load call history');
      throw error;
    }
  };

  const contextValue = {
    // State
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
    
    // Refs
    localVideoRef,
    remoteVideoRef,
    
    // Actions
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    toggleAudio,
    toggleVideo,
    loadCallHistory,
    formatCallDuration,
    
    // STOMP status
    isStompConnected: isConnected
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  
  if (!context) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('useCall must be used within a CallProvider');
    }
    
    return {
      call: null,
      callStatus: null,
      callType: null,
      isReceivingCall: false,
      isMakingCall: false,
      callHistory: [],
      localStream: null,
      remoteStream: null,
      isAudioEnabled: true,
      isVideoEnabled: true,
      callDuration: 0,
      localVideoRef: { current: null },
      remoteVideoRef: { current: null },
      initiateCall: async () => { 
        throw new Error('CallProvider not available'); 
      },
      answerCall: async () => { 
        throw new Error('CallProvider not available'); 
      },
      endCall: async () => { 
        throw new Error('CallProvider not available'); 
      },
      rejectCall: async () => { 
        throw new Error('CallProvider not available'); 
      },
      toggleAudio: () => false,
      toggleVideo: () => false,
      loadCallHistory: async () => [],
      formatCallDuration: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      },
      isStompConnected: false
    };
  }
  
  return context;
};