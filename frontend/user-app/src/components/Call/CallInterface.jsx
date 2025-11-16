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
  // Sử dụng CallContext thay vì tự quản lý state
  const {
    call: contextCall,
    endCall: contextEndCall,
    callStatus,
    isReceivingCall,
    isMakingCall,
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    toggleAudio,
    toggleVideo,
    answerCall: contextAnswerCall,
    rejectCall: contextRejectCall
  } = useCall();

  const socket = useSocket();

  // Determine active sources (prop takes precedence)
  const call = propCall || contextCall;
  const onEndCall = propOnEndCall || contextEndCall;

  // State cho UI controls
  const [isMuted, setIsMuted] = useState(!isAudioEnabled);
  const [isVideoOn, setIsVideoOn] = useState(isVideoEnabled);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Sync với CallContext audio/video state
  useEffect(() => {
    setIsMuted(!isAudioEnabled);
    setIsVideoOn(isVideoEnabled);
  }, [isAudioEnabled, isVideoEnabled]);

  // If there is no call information available, do not render anything
  if (!call) {
    return null;
  }

  // Get target user info
  const getParticipantName = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.fullName || otherParticipant?.username || 'Unknown';
    }
    return call.receiverName || 'Unknown';
  };

  const getParticipantAvatar = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.profilePicture;
    }
    return call.receiverAvatar || null;
  };

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize WebRTC connection
  useEffect(() => {
    if (call && (callStatus === 'ongoing' || callStatus === 'ringing')) {
      initializeWebRTC();
    }

    return () => {
      cleanupMedia();
    };
  }, [call, callStatus]);

  const initializeWebRTC = async () => {
    try {
      peerConnectionRef.current = new RTCPeerConnection(rtcConfig);

      // Add local stream tracks if available from context
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStream);
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
        if (event.candidate && call.receiverId) {
          socket.emit('call-signal', {
            userId: call.receiverId,
            signal: {
              type: 'candidate',
              candidate: event.candidate
            }
          });
        }
      };

      // Handle connection state changes
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnectionRef.current.connectionState);
        setConnectionStatus(peerConnectionRef.current.connectionState);
      };

      // Create and send offer if we are the caller
      if (isMakingCall && !isReceivingCall) {
        createAndSendOffer();
      }

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
    }
  };

  const createAndSendOffer = async () => {
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (call.receiverId) {
        socket.emit('call-signal', {
          userId: call.receiverId,
          signal: {
            type: 'offer',
            sdp: peerConnectionRef.current.localDescription.sdp
          }
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // WebRTC signaling events - sử dụng socket events từ CallContext
  useEffect(() => {
    if (!socket) return;

    // Handle incoming WebRTC offer (khi là callee)
    socket.on('call-signal', async (data) => {
      try {
        const { type, sdp, candidate } = data.signal;
        
        if (type === 'offer' && isReceivingCall) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          socket.emit('call-signal', {
            userId: data.userId,
            signal: {
              type: 'answer',
              sdp: peerConnectionRef.current.localDescription.sdp
            }
          });
        } else if (type === 'answer' && isMakingCall) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
          setConnectionStatus('connected');
        } else if (type === 'candidate') {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('Error adding received ice candidate', err);
          }
        }
      } catch (error) {
        console.error('Error handling signaling data:', error);
      }
    });

    return () => {
      socket.off('call-signal');
    };
  }, [socket, isReceivingCall, isMakingCall]);

  const cleanupMedia = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const handleEndCall = () => {
    cleanupMedia();
    if (onEndCall) {
      onEndCall();
    }
  };

  const handleToggleMute = () => {
    const newState = toggleAudio();
    setIsMuted(!newState); // toggleAudio returns the new state
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo();
    setIsVideoOn(newState); // toggleVideo returns the new state
  };

  const handleAnswerCall = () => {
    contextAnswerCall();
  };

  const handleRejectCall = () => {
    contextRejectCall();
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
        // Switch back to camera if available
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
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

  // Hiển thị incoming call popup
  if (isReceivingCall && callStatus === 'ringing') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <Avatar
              src={getParticipantAvatar()}
              alt={getParticipantName()}
              size="xl"
              className="mx-auto mb-4"
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Incoming Call
            </h2>
            <p className="text-gray-600 mb-1">
              {getParticipantName()} is calling you
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {call.type === 'video' ? 'Video Call' : 'Audio Call'}
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
  }

  // Hiển thị active call interface
  return (
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
          {isMakingCall && ' • Calling...'}
          {isReceivingCall && ' • Incoming...'}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative">
        {isVideoCall ? (
          <>
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local Video */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* Connection Status Overlay */}
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
          /* Audio Call - Show Avatar */
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
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
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

          {/* Video Button (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition-colors ${
                !isVideoOn 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isVideoOn ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoOn ? (
                <VideoCameraIcon className="w-6 h-6 text-white" />
              ) : (
                <VideoCameraIconSolid className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* Screen Share Button (only for video calls) */}
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

          {/* Speaker Button */}
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

          {/* End Call Button */}
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
  );
};

export default CallInterface;