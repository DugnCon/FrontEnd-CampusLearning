/*-----------------------------------------------------------------
* File: CallContext.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Context for managing call state and WebRTC connections using STOMP
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { 
  createPeerConnection, 
  getLocalStream, 
  addTracksToConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  endCall as endWebRTCCall
} from '../utils/webRTC';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { isConnected, subscribe, unsubscribe, sendMessage } = useSocket();
  const { user } = useAuth();
  
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

  // STOMP destinations
  const CALL_EVENTS = {
    // Subscribe destinations
    INCOMING_CALL: '/topic/call.incoming',
    CALL_ANSWERED: '/topic/call.answered',
    CALL_ENDED: '/topic/call.ended',
    CALL_REJECTED: '/topic/call.rejected',
    CALL_SIGNALING: '/topic/call.signaling',
    CALL_SCREEN_SHARE: '/topic/call.screenshare',
    CALL_MEDIA_TOGGLE: '/topic/call.media',
    
    // Send destinations
    INITIATE_CALL: '/app/call.initiate',
    ANSWER_CALL: '/app/call.answer',
    END_CALL: '/app/call.end',
    REJECT_CALL: '/app/call.reject',
    SEND_SIGNAL: '/app/call.signal',
    TOGGLE_MEDIA: '/app/call.media.toggle',
    SCREEN_SHARE: '/app/call.screenshare'
  };

  // Check for active call on load
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const { hasActiveCall, call } = await callService.getActiveCall();
        if (hasActiveCall) {
          setCall(call);
          setCallStatus('ongoing');
          setCallType(call.Type);
          await setupMediaAndConnection({ callId: call.CallID });
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
    };
  }, [user, isCallServiceAvailable]);

  // STOMP event listeners for call handling
  useEffect(() => {
    if (!isConnected || !isCallServiceAvailable) return;

    console.log('📡 Setting up STOMP call listeners...');

    // Incoming call handler
    const handleIncomingCall = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('📞 Incoming call via STOMP:', data);
        
        setCall(data.call || data);
        setCallType(data.type || data.call?.type);
        setCallStatus('ringing');
        setIsReceivingCall(true);
        
        // Show incoming call notification
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
            max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={data.callerAvatar || data.initiatorPicture || '/default-avatar.png'}
                    alt={data.callerName || data.initiatorName}
                  />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {data.callerName || data.initiatorName || 'Unknown Caller'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {data.type === 'video' ? 'Video Call' : 'Audio Call'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => {
                  answerCall();
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-green-600 hover:text-green-500 focus:outline-none"
              >
                Answer
              </button>
              <button
                onClick={() => {
                  rejectCall();
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none"
              >
                Decline
              </button>
            </div>
          </div>
        ), {
          duration: 30000,
        });
      } catch (error) {
        console.error('Error handling incoming call:', error);
      }
    };

    // Call answered handler
    const handleCallAnswered = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('✅ Call answered via STOMP:', data);
        
        setCallStatus('ongoing');
        setIsReceivingCall(false);
        setIsMakingCall(false);
        startCallTimer();
        
        // Setup peer connection for the call
        setupMediaAndConnection({ 
          callId: data.callId || call?.callId,
          isReceivingCall: false,
          fromUserId: data.userId || data.answererId
        });
      } catch (error) {
        console.error('Error handling call answered:', error);
      }
    };

    // Call ended handler
    const handleCallEnded = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('❌ Call ended via STOMP:', data);
        
        const duration = formatCallDuration(data.duration || callDuration);
        toast.success(`Call ended. Duration: ${duration}`);
        endCallCleanup();
      } catch (error) {
        console.error('Error handling call ended:', error);
      }
    };

    // Call rejected handler
    const handleCallRejected = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('❌ Call rejected via STOMP:', data);
        
        toast.error('Call was rejected');
        endCallCleanup();
      } catch (error) {
        console.error('Error handling call rejected:', error);
      }
    };

    // WebRTC signaling handlers
    const handleSignalingData = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('📡 Received signaling data via STOMP:', data);
        
        handleWebRTCSignaling(data);
      } catch (error) {
        console.error('Error handling signaling data:', error);
      }
    };

    // Screen share events
    const handleScreenShareStarted = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('🖥️ Remote user started screen share via STOMP:', data);
        toast.info('Remote user started screen sharing');
      } catch (error) {
        console.error('Error handling screen share started:', error);
      }
    };

    const handleScreenShareStopped = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('🖥️ Remote user stopped screen share via STOMP:', data);
        toast.info('Remote user stopped screen sharing');
      } catch (error) {
        console.error('Error handling screen share stopped:', error);
      }
    };

    // Media toggle events
    const handleMediaToggle = (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('Media toggle via STOMP:', data);
        
        if (data.type === 'audio') {
          toast.info(`Remote user ${data.enabled ? 'unmuted' : 'muted'}`);
        } else if (data.type === 'video') {
          toast.info(`Remote user ${data.enabled ? 'enabled' : 'disabled'} video`);
        }
      } catch (error) {
        console.error('Error handling media toggle:', error);
      }
    };

    // Subscribe to STOMP destinations
    const incomingCallSub = subscribe(CALL_EVENTS.INCOMING_CALL, handleIncomingCall);
    const callAnsweredSub = subscribe(CALL_EVENTS.CALL_ANSWERED, handleCallAnswered);
    const callEndedSub = subscribe(CALL_EVENTS.CALL_ENDED, handleCallEnded);
    const callRejectedSub = subscribe(CALL_EVENTS.CALL_REJECTED, handleCallRejected);
    const signalingSub = subscribe(CALL_EVENTS.CALL_SIGNALING, handleSignalingData);
    const screenShareSub = subscribe(CALL_EVENTS.CALL_SCREEN_SHARE, (message) => {
      const data = JSON.parse(message.body);
      if (data.action === 'started') {
        handleScreenShareStarted(message);
      } else if (data.action === 'stopped') {
        handleScreenShareStopped(message);
      }
    });
    const mediaToggleSub = subscribe(CALL_EVENTS.CALL_MEDIA_TOGGLE, handleMediaToggle);

    // Cleanup
    return () => {
      if (incomingCallSub) unsubscribe(CALL_EVENTS.INCOMING_CALL);
      if (callAnsweredSub) unsubscribe(CALL_EVENTS.CALL_ANSWERED);
      if (callEndedSub) unsubscribe(CALL_EVENTS.CALL_ENDED);
      if (callRejectedSub) unsubscribe(CALL_EVENTS.CALL_REJECTED);
      if (signalingSub) unsubscribe(CALL_EVENTS.CALL_SIGNALING);
      if (screenShareSub) unsubscribe(CALL_EVENTS.CALL_SCREEN_SHARE);
      if (mediaToggleSub) unsubscribe(CALL_EVENTS.CALL_MEDIA_TOGGLE);
    };
  }, [isConnected, isCallServiceAvailable, call]);

  // WebRTC signaling handler
  const handleWebRTCSignaling = async (data) => {
    try {
      console.log('🔄 Processing WebRTC signaling:', data.signal?.type, data);
      
      if (!peerConnectionRef.current) {
        console.log('Setting up new peer connection for incoming call/signal');
        await setupMediaAndConnection({ 
          isReceivingCall: true, 
          fromUserId: data.fromUserId
        });
      }
      
      const { type, sdp, candidate } = data.signal;
      
      if (type === 'offer') {
        console.log('Setting remote description (offer)');
        await setRemoteDescription(peerConnectionRef.current, { type, sdp });
        
        console.log('Creating answer');
        const answer = await createAnswer(peerConnectionRef.current);
        
        console.log('Sending answer to:', data.fromUserId);
        sendMessage(CALL_EVENTS.SEND_SIGNAL, {
          toUserId: data.fromUserId,
          callId: data.callId,
          signal: {
            type: 'answer',
            sdp: peerConnectionRef.current.localDescription.sdp
          }
        });
      } else if (type === 'answer') {
        console.log('Setting remote description (answer)');
        await setRemoteDescription(peerConnectionRef.current, { type, sdp });
        console.log('Connection should be establishing now');
      } else if (type === 'candidate') {
        try {
          console.log('Adding ICE candidate');
          await addIceCandidate(peerConnectionRef.current, candidate);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error adding received ice candidate', err);
          }
        }
      }
    } catch (error) {
      console.warn('Error handling WebRTC signaling:', error);
      toast.error('Failed to establish connection');
    }
  };

  // Set up media streams and peer connection using webRTC.js
  const setupMediaAndConnection = async ({ callId, isReceivingCall = false, fromUserId }) => {
    try {
      // ✅ DÙNG getLocalStream TỪ webRTC.js
      const stream = await getLocalStream(true, callType === 'video');
      setLocalStream(stream);

      // Set local video source
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // ✅ DÙNG createPeerConnection TỪ webRTC.js
      const peerConnection = createPeerConnection();
      peerConnectionRef.current = peerConnection;

      // ✅ DÙNG addTracksToConnection TỪ webRTC.js
      addTracksToConnection(peerConnection, stream);

      // Set up remote stream handler
      peerConnection.ontrack = (event) => {
        console.log('🎥 Got remote track:', event.streams[0]);
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Send ICE candidates to the other peer via STOMP
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Generated new ICE candidate');
          
          const targetUserId = fromUserId || call?.initiatorId || call?.receiverId;
          if (targetUserId && isConnected) {
            sendMessage(CALL_EVENTS.SEND_SIGNAL, {
              toUserId: targetUserId,
              callId: callId || call?.callId,
              signal: {
                type: 'candidate',
                candidate: event.candidate
              }
            });
          }
        }
      };
      
      // Log connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        
        switch (peerConnection.iceConnectionState) {
          case 'connected':
            toast.success('Call connected');
            break;
          case 'disconnected':
            toast.warning('Call connection weak');
            break;
          case 'failed':
            toast.error('Call connection failed');
            endCall();
            break;
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
      };

      // Create and send offer if initiating the call
      if (!isReceivingCall && call) {
        // ✅ DÙNG createOffer TỪ webRTC.js
        const offer = await createOffer(peerConnection);
        
        const targetUserId = fromUserId || call.receiverId;
        if (targetUserId && isConnected) {
          sendMessage(CALL_EVENTS.SEND_SIGNAL, {
            toUserId: targetUserId,
            callId: call.callId,
            signal: {
              type: 'offer',
              sdp: peerConnection.localDescription.sdp
            }
          });
        }
      }

      // Join call room via STOMP
      if (callId && isConnected) {
        sendMessage('/app/call.join', { callId });
      }

      return peerConnection;
    } catch (error) {
      console.error('Error setting up media and connection:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow camera and microphone access');
      } else if (error.name === 'NotFoundError') {
        toast.error('Camera or microphone not found');
      } else if (error.name === 'NotReadableError') {
        toast.error('Camera or microphone is already in use');
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
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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

  // Stop all media tracks using webRTC.js
  const stopMediaTracks = () => {
    // ✅ DÙNG endWebRTCCall TỪ webRTC.js
    endWebRTCCall(peerConnectionRef.current, localStream);
    
    setLocalStream(null);
    setRemoteStream(null);
  };

  // API: Initiate a call using STOMP
  const initiateCall = async (conversationID, type = 'video') => {
    try {
      if (!isConnected) {
        throw new Error('Socket not connected');
      }

      setIsMakingCall(true);
      setCallType(type);
      
      // Call API to create call record
      const response = await callService.initiateCall(conversationID, type);
      setCall(response.call);
      setCallStatus('ringing');
      
      // Send STOMP message to initiate call
      sendMessage(CALL_EVENTS.INITIATE_CALL, {
        conversationID: conversationID,
        type: type,
        callId: response.call.callId,
        callerId: user.id,
        callerName: user.fullName,
        callerAvatar: user.avatar
      });
      
      await setupMediaAndConnection({ 
        callId: response.call.callId,
        isReceivingCall: false
      });
      
      return response.call;
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Failed to initiate call');
      endCallCleanup();
      throw error;
    }
  };

  // API: Answer an incoming call using STOMP
  const answerCall = async () => {
    try {
      if (!call) {
        throw new Error('No call to answer');
      }

      if (!isConnected) {
        throw new Error('Socket not connected');
      }

      // Call API to update call status
      const response = await callService.answerCall(call.callId || call.CallID);
      setCallStatus('ongoing');
      setIsReceivingCall(false);
      
      // Send STOMP message that call was answered
      sendMessage(CALL_EVENTS.ANSWER_CALL, {
        callId: call.callId || call.CallID,
        answererId: user.id,
        answererName: user.fullName
      });
      
      await setupMediaAndConnection({ 
        callId: call.callId || call.CallID,
        isReceivingCall: true,
        fromUserId: call.initiatorId
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

  // API: End an active call using STOMP
  const endCall = async () => {
    try {
      if (!call) return;

      if (isConnected) {
        sendMessage(CALL_EVENTS.END_CALL, {
          callId: call.callId || call.CallID,
          duration: callDuration,
          endedBy: user.id
        });
        
        sendMessage('/app/call.leave', { callId: call.callId || call.CallID });
      }

      await callService.endCall(call.callId || call.CallID);
      endCallCleanup();
      
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error(error.message || 'Failed to end call');
      endCallCleanup();
      throw error;
    }
  };

  // API: Reject an incoming call using STOMP
  const rejectCall = async () => {
    try {
      if (!call) return;

      if (isConnected) {
        sendMessage(CALL_EVENTS.REJECT_CALL, {
          callId: call.callId || call.CallID,
          rejectedBy: user.id,
          rejectedByName: user.fullName
        });
      }

      await callService.rejectCall(call.callId || call.CallID);
      endCallCleanup();
    } catch (error) {
      console.error('Error rejecting call:', error);
      toast.error(error.message || 'Failed to reject call');
      endCallCleanup();
      throw error;
    }
  };

  // Toggle audio and notify via STOMP
  const toggleAudio = () => {
    if (localStream) {
      const enabled = !isAudioEnabled;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      setIsAudioEnabled(enabled);
      
      // Notify other participants via STOMP
      if (isConnected && call) {
        sendMessage(CALL_EVENTS.TOGGLE_MEDIA, {
          callId: call.callId || call.CallID,
          type: 'audio',
          enabled,
          userId: user.id
        });
      }
      
      return enabled;
    }
    return isAudioEnabled;
  };

  // Toggle video and notify via STOMP
  const toggleVideo = () => {
    if (localStream) {
      const enabled = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      setIsVideoEnabled(enabled);
      
      // Notify other participants via STOMP
      if (isConnected && call) {
        sendMessage(CALL_EVENTS.TOGGLE_MEDIA, {
          callId: call.callId || call.CallID,
          type: 'video',
          enabled,
          userId: user.id
        });
      }
      
      return enabled;
    }
    return isVideoEnabled;
  };

  // Screen share functions
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });

      if (peerConnectionRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      // Notify via STOMP
      if (isConnected && call) {
        sendMessage(CALL_EVENTS.SCREEN_SHARE, {
          callId: call.callId || call.CallID,
          action: 'started',
          userId: user.id
        });
      }

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
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
    
    // Methods
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    loadCallHistory,
    formatCallDuration
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};