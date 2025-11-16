import React, { useState, useRef, useEffect } from 'react';
// Context
import { useCall } from '../../contexts/CallContext';
import { useSocket } from '../../contexts/SocketContext';
import { 
  PhoneXMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneIconSolid,
  VideoCameraIcon as VideoCameraIconSolid
} from '@heroicons/react/24/solid';
import Avatar from '../common/Avatar';

const CallInterface = ({ call: propCall, onEndCall: propOnEndCall, isVideoCall = false }) => {
  // Grab data from context – will be undefined if not within provider
  const {
    call: contextCall,
    endCall: contextEndCall,
    callStatus,
  } = useCall() || {};

  const socket = useSocket();

  // Determine active sources (prop takes precedence so we can still use component standalone in other places)
  const call = propCall || contextCall;
  const onEndCall = propOnEndCall || contextEndCall;

  // ✅ THÊM: State cho incoming call
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const targetUserIdRef = useRef(null);

  // ✅ THÊM: WebSocket listeners cho incoming calls
  useEffect(() => {
    if (!socket) return;

    console.log('🎯 Setting up incoming call listeners...');

    // Listen for incoming call
    socket.on('CALL_INITIATED', (data) => {
      console.log('📞 INCOMING CALL RECEIVED:', data);
      setIncomingCall(data.data);
    });

    socket.on('CALL_ANSWERED', (data) => {
      console.log('✅ CALL ANSWERED:', data);
      setConnectionStatus('connected');
    });

    socket.on('CALL_ENDED', (data) => {
      console.log('❌ CALL ENDED:', data);
      handleEndCall();
    });

    socket.on('CALL_REJECTED', (data) => {
      console.log('🚫 CALL REJECTED:', data);
      setIncomingCall(null);
    });

    return () => {
      socket.off('CALL_INITIATED');
      socket.off('CALL_ANSWERED');
      socket.off('CALL_ENDED');
      socket.off('CALL_REJECTED');
    };
  }, [socket]);

  // ✅ THÊM: Incoming Call Handler Functions
  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    
    try {
      console.log('📞 Answering call:', incomingCall.callId);
      // Gọi API answer call
      // await callApi.answerCall({ callId: incomingCall.callId });
      
      // Set active call và initialize WebRTC
      // call = incomingCall; // Không thể reassign prop
      await initializeCall();
      setIncomingCall(null);
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      console.log('🚫 Rejecting call:', incomingCall.callId);
      // Gọi API reject call
      // await callApi.rejectCall({ callId: incomingCall.callId });
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  // ✅ THÊM: Incoming Call Component (embedded)
  const IncomingCallPopup = () => {
    if (!incomingCall) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <Avatar
              src={incomingCall.initiatorPicture}
              alt={incomingCall.initiatorName}
              size="xl"
              className="mx-auto mb-4"
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Incoming Call
            </h2>
            <p className="text-gray-600 mb-1">
              {incomingCall.initiatorName} is calling you
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {incomingCall.type === 'video' ? 'Video Call' : 'Audio Call'}
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRejectCall}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAnswerCall}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full transition-colors"
              >
                Answer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // If there is no call information available, do not render anything
  if (!call && !incomingCall) {
    return null;
  }

  // ✅ THÊM: Nếu có incoming call, chỉ hiển thị popup
  if (incomingCall && !call) {
    return <IncomingCallPopup />;
  }

  // Get target user ID
  useEffect(() => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      targetUserIdRef.current = otherParticipant?.userID;
    }
  }, [call]);

  // Timer for call duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Initialize media stream and WebRTC
  useEffect(() => {
    if (call) {
      initializeCall();
    }
    return () => {
      cleanupMedia();
    };
  }, [isVideoCall, call]);

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const initializeCall = async () => {
    try {
      await initializeMedia();
      await initializeWebRTC();
      
      if (call.initiatorID === getCurrentUserId()) {
        // We are the caller - create and send offer
        await createAndSendOffer();
      }
    } catch (error) {
      console.error('Error initializing call:', error);
    }
  };

  const initializeMedia = async () => {
    try {
      const constraints = {
        audio: true,
        video: isVideoCall
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && isVideoCall) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const initializeWebRTC = async () => {
    try {
      peerConnectionRef.current = new RTCPeerConnection(rtcConfig);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // Handle incoming remote stream
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Received remote stream');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setConnectionStatus('connected');
        }
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && targetUserIdRef.current) {
          socket.emit('webrtc-ice-candidate', {
            to: targetUserIdRef.current,
            candidate: event.candidate
          });
        }
      };

      // Handle connection state changes
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnectionRef.current.connectionState);
        setConnectionStatus(peerConnectionRef.current.connectionState);
      };

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
    }
  };

  const createAndSendOffer = async () => {
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (targetUserIdRef.current) {
        socket.emit('webrtc-offer', {
          to: targetUserIdRef.current,
          offer: offer,
          callType: isVideoCall ? 'video' : 'audio',
          callId: call.callID
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // WebRTC signaling events
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc-offer', async (data) => {
      try {
        await peerConnectionRef.current.setRemoteDescription(data.offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
          to: data.from,
          answer: answer,
          callId: data.callId
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('webrtc-answer', async (data) => {
      try {
        await peerConnectionRef.current.setRemoteDescription(data.answer);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.on('webrtc-ice-candidate', async (data) => {
      try {
        await peerConnectionRef.current.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    return () => {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [socket]);

  const getCurrentUserId = () => {
    return localStorage.getItem('userId') || 'current-user';
  };

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const handleEndCall = () => {
    // WebSocket notification đến user khác
    if (targetUserIdRef.current) {
      socket.emit('end-call', {
        to: targetUserIdRef.current,
        callId: call.callID
      });
    }

    cleanupMedia();
    if (onEndCall) {
      onEndCall();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOn;
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
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

      setIsScreenSharing(true);

      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        if (localStreamRef.current) {
          const cameraTrack = localStreamRef.current.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender && cameraTrack) {
            sender.replaceTrack(cameraTrack);
          }
        }
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getParticipantName = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.fullName || otherParticipant?.username || 'Unknown';
    }
    return 'Unknown';
  };

  const getParticipantAvatar = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.profilePicture;
    }
    return null;
  };

  return (
    <>
      {/* Incoming Call Popup */}
      <IncomingCallPopup />
      
      {/* Active Call Interface */}
      {call && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          {/* Call Header */}
          <div className="bg-black bg-opacity-50 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar
                src={getParticipantAvatar()}
                alt={getParticipantName()}
                size="md"
              />
              <div>
                <h2 className="text-lg font-semibold">{getParticipantName()}</h2>
                <p className="text-sm text-gray-300">
                  {formatCallDuration(callDuration)}
                  <span className={`ml-2 text-xs ${
                    connectionStatus === 'connected' ? 'text-green-400' : 
                    connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    • {connectionStatus}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="text-sm text-gray-300">
              {isVideoCall ? 'Video Call' : 'Voice Call'}
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative">
            {isVideoCall ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>

                {connectionStatus !== 'connected' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-center">
                      <div className="text-lg mb-2">
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                      </div>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Avatar
                    src={getParticipantAvatar()}
                    alt={getParticipantName()}
                    size="2xl"
                    className="mx-auto mb-4"
                  />
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {getParticipantName()}
                  </h2>
                  <p className="text-gray-300">
                    {formatCallDuration(callDuration)}
                    <span className={`ml-2 text-xs ${
                      connectionStatus === 'connected' ? 'text-green-400' : 
                      connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      • {connectionStatus}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="bg-black bg-opacity-75 p-6">
            <div className="flex items-center justify-center space-x-6">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <MicrophoneIconSolid className="w-6 h-6 text-white" />
                ) : (
                  <MicrophoneIcon className="w-6 h-6 text-white" />
                )}
              </button>

              {isVideoCall && (
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition-colors ${
                    !isVideoEnabled 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
                >
                  {isVideoEnabled ? (
                    <VideoCameraIcon className="w-6 h-6 text-white" />
                  ) : (
                    <VideoCameraIconSolid className="w-6 h-6 text-white" />
                  )}
                </button>
              )}

              {isVideoCall && (
                <button
                  onClick={startScreenShare}
                  className={`p-4 rounded-full transition-colors ${
                    isScreenSharing 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                  <ComputerDesktopIcon className="w-6 h-6 text-white" />
                </button>
              )}

              <button
                onClick={toggleSpeaker}
                className={`p-4 rounded-full transition-colors ${
                  isSpeakerOn 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
              >
                <SpeakerWaveIcon className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={handleEndCall}
                className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                title="End call"
              >
                <PhoneXMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CallInterface;