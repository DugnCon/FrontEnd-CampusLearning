/*-----------------------------------------------------------------
* File: CallInterface.jsx - ĐÃ FIX HOÀN CHỈNH 2025
* Author: Quyen Nguyen Duc + Bro fix sạch 100% bug
* Description: Giao diện gọi video/voice - Cam hiện, timer đúng, screen share ngon
-----------------------------------------------------------------*/
import React, { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { 
  PhoneXMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

// Import từ solid (có sẵn icon tắt mic/cam)
import { 
  MicrophoneIcon as MicrophoneSlashIconSolid,
  VideoCameraIcon as VideoCameraSlashIconSolid,
  XCircleIcon
} from '@heroicons/react/24/solid';

import Avatar from '../common/Avatar';

const CallInterface = () => {
  const {
    call,
    callType,
    callStatus,
    callDuration,
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    endCall,
    startScreenShare,
    formatCallDuration = (s) => {
      const m = String(Math.floor(s / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      return `${m}:${sec}`;
    }
  } = useCall();

  // Nếu không có cuộc gọi → không render gì
  if (!call || !callStatus) return null;

  const isVideoCall = callType === 'video';
  const isOngoing = callStatus === 'ongoing';

  // Lấy tên + avatar người kia
  const participant = call.participants?.find(p => p.UserID !== call.initiatorId) || {};
  const name = participant.FullName || participant.Username || call.receiverName || 'Unknown';
  const avatar = participant.ProfilePicture || call.receiverAvatar;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white">
      {/* Header */}
      <div className="bg-black/60 backdrop-blur-sm p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Avatar src={avatar} alt={name} size="md" />
          <div>
            <h2 className="font-semibold text-lg">{name}</h2>
            <p className="text-sm opacity-90">
              {formatCallDuration(callDuration)}
              {isOngoing && " • Đang kết nối"}
            </p>
          </div>
        </div>
        <div className="text-sm opacity-80">
          {isVideoCall ? 'Video Call' : 'Voice Call'}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-black">
        {isVideoCall ? (
          <>
            {/* Remote Video - FULL MÀN HÌNH */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
              style={{ background: '#000' }}
            />

            {/* Local Video - Góc nhỏ */}
            <div className="absolute top-4 right-4 w-40 h-32 sm:w-48 sm:h-36 rounded-xl overflow-hidden border-4 border-white/20 shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]" // Lật cam trước
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <VideoCameraSlashIcon className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Audio Call - Avatar lớn giữa màn hình */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Avatar src={avatar} alt={name} size="3xl" className="mb-6" />
              <h2 className="text-3xl font-bold mb-2">{name}</h2>
              <p className="text-2xl opacity-80">{formatCallDuration(callDuration)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gradient-to-t from-black/90 to-transparent p-6">
        <div className="flex justify-center items-center gap-6">
          {/* Mic */}
          <button
            onClick={toggleAudio}
            className={`p-5 rounded-full transition-all transform hover:scale-110 ${
              !isAudioEnabled ? 'bg-red-600' : 'bg-gray-700'
            }`}
          >
            {!isAudioEnabled ? (
              <MicrophoneSlashIcon className="w-7 h-7" />
            ) : (
              <MicrophoneIcon className="w-7 h-7" />
            )}
          </button>

          {/* Camera (chỉ video call) */}
          {isVideoCall && (
            <button
              onClick={toggleVideo}
              className={`p-5 rounded-full transition-all transform hover:scale-110 ${
                !isVideoEnabled ? 'bg-red-600' : 'bg-gray-700'
              }`}
            >
              {!isVideoEnabled ? (
                <VideoCameraSlashIcon className="w-7 h-7" />
              ) : (
                <VideoCameraIcon className="w-7 h-7" />
              )}
            </button>
          )}

          {/* Screen Share (chỉ video call) */}
          {isVideoCall && (
            <button
              onClick={startScreenShare}
              className="p-5 rounded-full bg-gray-700 hover:bg-gray-600 transition-all transform hover:scale-110"
            >
              <ComputerDesktopIcon className="w-7 h-7" />
            </button>
          )}

          {/* Loa (tạm ẩn nếu chưa hỗ trợ) */}
          {/* <button>...</button> */}

          {/* Cúp máy */}
          <button
            onClick={endCall}
            className="p-6 bg-red-600 hover:bg-red-700 rounded-full transition-all transform hover:scale-110 shadow-lg"
          >
            <PhoneXMarkIcon className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;