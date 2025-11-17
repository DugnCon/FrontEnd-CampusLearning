/*-----------------------------------------------------------------
* File: CallInterface.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Call interface component for voice and video calls
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useRef, useEffect } from 'react';
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
  // Context data
  const {
    call: contextCall,
    endCall: contextEndCall,
    callStatus,
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo
  } = useCall() || {};

  const { socket, user: currentUser } = useSocket();

  // Determine active sources
  const call = propCall || contextCall;
  const onEndCall = propOnEndCall || contextEndCall;

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(isVideoCall);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Timer for call duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Setup video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle speaker output
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (isSpeakerOn) {
        // For external speaker output
        remoteVideoRef.current.setSinkId?.('default')
          .catch(err => console.warn('Error setting audio output:', err));
      }
    }
  }, [isSpeakerOn]);

  const handleToggleMute = () => {
    const newState = toggleAudio ? toggleAudio() : !isMuted;
    setIsMuted(!newState);
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo ? toggleVideo() : !isVideoOn;
    setIsVideoOn(newState);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'window'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      screenStreamRef.current = screenStream;

      // Replace video track in peer connection
      if (socket && call) {
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Notify other participants about screen share
        socket.emit('screen-share-started', {
          callId: call.callId || call.CallID
        });

        // Update local video to show screen share
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
      }

      // Handle when screen share ends
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
      if (error.name !== 'NotAllowedError') {
        alert('Failed to start screen sharing');
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Switch back to camera
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      // Notify other participants
      if (socket && call) {
        socket.emit('screen-share-stopped', {
          callId: call.callId || call.CallID
        });
      }

      setIsScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  const handleEndCall = () => {
    // Stop screen share if active
    if (isScreenSharing) {
      stopScreenShare();
    }
    
    if (onEndCall) {
      onEndCall();
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
    if (!call) return 'Unknown';
    
    if (call.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => 
        p.UserID !== call.initiatorId && p.UserID !== currentUser?.id
      );
      return otherParticipant?.FullName || otherParticipant?.Username || 'Unknown';
    }
    
    return call.receiverName || 'Unknown';
  };

  const getParticipantAvatar = () => {
    if (!call) return null;
    
    if (call.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => 
        p.UserID !== call.initiatorId && p.UserID !== currentUser?.id
      );
      return otherParticipant?.ProfilePicture;
    }
    
    return call.receiverAvatar || null;
  };

  // If there is no call information available, do not render anything
  if (!call) {
    return null;
  }

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
              {isScreenSharing && " • Sharing screen"}
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-300">
          {isVideoCall ? 'Video Call' : 'Voice Call'}
          {callStatus && ` • ${callStatus}`}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
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
            <div className={`absolute ${
              isScreenSharing ? 'bottom-4 left-4' : 'top-4 right-4'
            } w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 ${
              isScreenSharing ? 'border-red-500' : 'border-gray-600'
            } shadow-lg`}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <span className="text-white text-sm">Camera off</span>
                </div>
              )}
            </div>

            {/* Screen Share Indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                Sharing Screen
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
              </p>
              {isScreenSharing && (
                <div className="mt-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium inline-block">
                  Sharing Screen
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-black bg-opacity-75 p-6">
        <div className="flex items-center justify-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`p-4 rounded-full transition-all ${
              isMuted 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            } transform hover:scale-105`}
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
              className={`p-4 rounded-full transition-all ${
                !isVideoOn 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              } transform hover:scale-105`}
              title={isVideoOn ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoOn ? (
                <VideoCameraIcon className="w-6 h-6 text-white" />
              ) : (
                <VideoCameraIconSolid className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* Screen Share Button */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`p-4 rounded-full transition-all ${
              isScreenSharing 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            } transform hover:scale-105`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <ComputerDesktopIcon className="w-6 h-6 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={`p-4 rounded-full transition-all ${
              isSpeakerOn 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            } transform hover:scale-105`}
            title={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
          >
            <SpeakerWaveIcon className="w-6 h-6 text-white" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-all transform hover:scale-105"
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