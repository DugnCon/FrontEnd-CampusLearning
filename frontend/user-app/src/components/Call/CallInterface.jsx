import React, { useState, useRef, useEffect } from 'react';
// Context
import { useCall } from '../../contexts/CallContext';
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
  // Sử dụng context với safe fallback
  const callContext = useCall();
  
  // Xác định nguồn dữ liệu với validation
  const call = propCall || callContext?.call;
  const contextEndCall = callContext?.endCall;
  const localStream = callContext?.localStream;
  const remoteStream = callContext?.remoteStream;
  const isAudioEnabled = callContext?.isAudioEnabled ?? true;
  const isVideoEnabled = callContext?.isVideoEnabled ?? true;
  const callDuration = callContext?.callDuration ?? 0;
  const toggleAudio = callContext?.toggleAudio;
  const toggleVideo = callContext?.toggleVideo;
  const localVideoRef = callContext?.localVideoRef || useRef(null);
  const remoteVideoRef = callContext?.remoteVideoRef || useRef(null);

  // Safe handler cho onEndCall
  const handleEndCall = () => {
    if (typeof propOnEndCall === 'function') {
      propOnEndCall();
    } else if (typeof contextEndCall === 'function') {
      contextEndCall();
    } else {
      console.error('No end call handler available');
      window.location.reload();
    }
  };

  // Safe handler cho toggle audio
  const handleToggleAudio = () => {
    if (typeof toggleAudio === 'function') {
      toggleAudio();
    } else {
      console.warn('Toggle audio not available');
    }
  };

  // Safe handler cho toggle video
  const handleToggleVideo = () => {
    if (typeof toggleVideo === 'function') {
      toggleVideo();
    } else {
      console.warn('Toggle video not available');
    }
  };

  // Nếu không có call data, không render
  if (!call) {
    return null;
  }

  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Setup video elements với streams từ context
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Hiện tại chỉ hiển thị local screen share
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      // Handle screen share end
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        // Switch back to camera
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getParticipantName = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.fullName || otherParticipant?.username || 'Unknown';
    }
    return call?.receiverName || call?.participantName || 'Unknown';
  };

  const getParticipantAvatar = () => {
    if (call?.participants && call.participants.length > 0) {
      const otherParticipant = call.participants.find(p => p.userID !== call.initiatorID);
      return otherParticipant?.profilePicture;
    }
    return call?.receiverAvatar || null;
  };

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
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-300">
          {isVideoCall ? 'Video Call' : 'Voice Call'}
          {callContext?.isStompConnected && (
            <span className="ml-2 text-green-400">● Connected</span>
          )}
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
              className="w-full h-full object-cover bg-black"
            />
            
            {/* Local Video */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
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
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="bg-black bg-opacity-75 p-6">
        <div className="flex items-center justify-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={handleToggleAudio}
            className={`p-4 rounded-full transition-colors ${
              !isAudioEnabled 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-6 h-6 text-white" />
            ) : (
              <MicrophoneIconSolid className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Video Button (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={handleToggleVideo}
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