

import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';
import { setSignalCallback } from '../utils/webRTC';

// WebRTC Utils
import {
  createPeerConnection,
  getLocalStream,
  addTracksToConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
} from '../utils/webRTC';

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { stompClient, isConnected, user , sendMessage, subscribe} = useSocket();

  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null); // 'idle' | 'ringing' | 'ongoing' | 'ended'
  const [callType, setCallType] = useState(null); // 'audio' | 'video'
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isMakingCall, setIsMakingCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const subscriptionsRef = useRef([]);

  // Gửi STOMP
  const sendSignal = (toUserId, callID, signal) => {
    if (!stompClient || !isConnected) return false;
    
    const message = {
        toUserID: toUserId.toString(),
        fromUserID: user?.id,
        callID: Number(callID),
        signal: {
          type: signal.type
        }
      };
      
      // Thêm sdp hoặc candidate tùy loại signal
      if (signal.type === 'offer' || signal.type === 'answer') {
        message.signal.sdp = signal.sdp;
      } else if (signal.type === 'candidate') {
        message.signal.candidate = signal.candidate;
      }

      console.log("Gửi signal:", message);
      
      sendMessage('/call.signal', message);
      return true;
  };

  // Format thời gian
  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Bắt đầu đếm giờ
  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  // Dọn dẹp
  const cleanup = () => {
    setCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    setCallDuration(0);

    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Setup WebRTC
  const setupWebRTC = async ({ isCaller = false, targetUserId, callID }) => {
    try {
      console.log("🎥 Setting up WebRTC, callType:", callType);
      
      const stream = await getLocalStream(true, callType === 'video');
      console.log("📹 Local stream obtained:", stream?.getTracks().length, "tracks");
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("🎬 Local video ref set");
      }

      setSignalCallback((signal) => sendSignal(targetUserId, callID, signal));
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        console.log("📡 Received remote track");
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          console.log("🎬 Remote video ref set");
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("❄️ ICE connection state:", pc.iceConnectionState);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("❄️ Sending ICE candidate");
          sendSignal(targetUserId, callID, {
            type: 'candidate',
            candidate: e.candidate.toJSON()
          });
        }
      };

      if (isCaller) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("📞 Creating offer...");
        const offer = await createOffer(pc);
        console.log("📞 Offer created, sending signal..." + " " + offer);
        
        sendSignal(targetUserId, callID, { 
          type: 'offer', 
          sdp: offer.sdp 
        });
      }

      return pc;
    } catch (err) {
      console.error("❌ WebRTC setup error:", err);
      toast.error('Không thể truy cập mic/camera: ' + err.message);
      cleanup();
      throw err;
    }
  };

  const handleSignal = async (data) => {
    const { signal, fromUserID: senderId, callID: callID } = data;
    
    console.log("📡 Nhận signal:", signal.type, "từ:", senderId);
    
    let pc = peerConnectionRef.current;
    if (!pc) {
      await setupWebRTC({ isCaller: false, targetUserId: senderId, callID });
      pc = peerConnectionRef.current;
    }

    try {
      if (signal.type === 'offer') {
        await setRemoteDescription(pc, { 
          type: 'offer', 
          sdp: signal.sdp 
        });
        const answer = await createAnswer(pc);
        sendSignal(senderId, callID, { 
          type: 'answer', 
          sdp: answer.sdp  
        });
      }
      else if (signal.type === 'answer') {
        await setRemoteDescription(pc, { 
          type: 'answer', 
          sdp: signal.sdp  
        });
        setCallStatus('ongoing');
        startTimer();
      }
      else if (signal.type === 'candidate') {
        await addIceCandidate(pc, signal.candidate); 
      }
    } catch (err) {
      console.error('Signal handling error:', err);
    }
  };

  // STOMP Subscriptions
  useEffect(() => {
    if (!isConnected || !subscribe) return;

    const unsubs = [
      subscribe('/user/queue/call.incoming', (data) => {
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        toast(`Cuộc gọi từ ${data.initiatorName || 'Ai đó'}`, { duration: 10000 });
      }),

      subscribe('/user/queue/call.answered', () => {
        setCallStatus('ongoing');
        setIsReceivingCall(false);
        startTimer();
      }),

      subscribe('/user/queue/call.ended', () => {
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }),

      subscribe('/user/queue/call.rejected', () => {
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }),

      // QUAN TRỌNG NHẤT – SIGNAL WEBRTC
      subscribe('/user/queue/call.signal', (data) => {
        console.log('NHẬN ĐƯỢC SIGNAL WEBRTC:', data);
        handleSignal(data);
      }),

      subscribe('/user/queue/call.error', (data) => {
        console.error("CALL ERROR từ server:", data);
        toast.error(data.message || 'Lỗi cuộc gọi');
        cleanup();
      })
    ];

    return () => {
      unsubs.forEach(unsub => unsub?.unsubscribe?.());
    };
  }, [isConnected, subscribe]);

  // ===== API CHO COMPONENT =====
  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    try {
      setIsMakingCall(true);
      setCallType(type);

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: type,
        conversationID: Number(conversationID)
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID
      });

      return callData;

    } catch (err) {
      console.error("Lỗi khởi tạo cuộc gọi:", err);
      toast.error('Không thể thực hiện cuộc gọi');
      cleanup(); // Đảm bảo tắt camera + dọn dẹp
      setIsMakingCall(false);
      return null;
    }
  };

  const answerCall = async () => {
    if (!call) return;

    await callService.answerCall(call.callID);

    sendMessage('/call.answer', {
      callID: call.callID,
      initiatorID: call.initiatorID,
      accepted: true
    });
  };

  const endCall = async () => {
    if (!call) return;
    await callService.endCall(call.callID);
    cleanup();
  };

  const rejectCall = async () => {
    if (!call) return;

    await callService.rejectCall(call.callID);

    sendMessage('/call.reject', {
      callID: call.callID,
      initiatorID: call.initiatorID,
    });
  };

  const value = {
    call, callStatus, callType,
    isReceivingCall, isMakingCall,
    localStream, remoteStream, callDuration,
    localVideoRef, remoteVideoRef,
    initiateCall, answerCall, endCall, rejectCall,
    formatDuration
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};