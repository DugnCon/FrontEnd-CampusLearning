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

  // 🚨 THÊM: Ref để lưu fromUserID
  const fromUserIDRef = useRef(null);

  // Gửi STOMP - CALL SOCKET ONLY
  const sendSignal = (toUserId, callID, signal) => {
    if (!stompClient || !isConnected) {
      console.log("🚨 [CALL SOCKET] NOT CONNECTED - Cannot send signal");
      return false;
    }
    
    const message = {
        toUserID: toUserId.toString(),
        fromUserID: fromUserIDRef.current || user?.id || user?.userID || user?.userId,
        callID: Number(callID),
        signal: {
          type: signal.type
        }
      };
      
      // Thêm sdp hoặc candidate tùy loại signal
      if (signal.type === 'offer' || signal.type === 'answer') {
        message.signal.sdp = signal.sdp;
        console.log(`📤 [CALL SOCKET] SENDING ${signal.type.toUpperCase()} to user: ${toUserId}, call: ${callID}`);
      } else if (signal.type === 'candidate') {
        message.signal.candidate = signal.candidate;
        console.log("📤 [CALL SOCKET] SENDING ICE CANDIDATE");
      }

      console.log("🎯 [CALL SOCKET] Signal details:", {
        toUserID: message.toUserID,
        fromUserID: message.fromUserID, 
        callID: message.callID,
        signalType: message.signal.type
      });
      
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
    console.log("🧹 [CALL] Cleaning up call...");
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
  const setupWebRTC = async ({ isCaller = false, targetUserId, callID, callType }) => {
    try {
      console.log("🎥 [CALL] Setting up WebRTC, callType:", callType, "isCaller:", isCaller);
      
      const stream = await getLocalStream(true, callType === 'video');
      console.log("📹 [CALL] Local stream obtained:", stream?.getTracks().length, "tracks");
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("🎬 [CALL] Local video ref set");
      }

      setSignalCallback((signal) => sendSignal(targetUserId, callID, signal));
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        console.log("📡 [CALL] Received remote track - streams:", e.streams.length);
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          console.log("🎬 [CALL] Remote video ref set");
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("❄️ [CALL] ICE connection state:", pc.iceConnectionState);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("❄️ [CALL] Sending ICE candidate");
          sendSignal(targetUserId, callID, {
            type: 'candidate',
            candidate: e.candidate.toJSON()
          });
        }
      };

      if (isCaller) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("📞 [CALL] Creating offer...");
        const offer = await createOffer(pc);
        console.log("📞 [CALL] Offer created, type:", offer.type, "sdp length:", offer.sdp?.length);
        
        sendSignal(targetUserId, callID, { 
          type: 'offer', 
          sdp: offer.sdp 
        });
      }

      return pc;
    } catch (err) {
      console.error("❌ [CALL] WebRTC setup error:", err);
      toast.error('Không thể truy cập mic/camera: ' + err.message);
      cleanup();
      throw err;
    }
  };

  const handleSignal = async (data) => {
    console.log("📨 [CALL SOCKET] RECEIVED SIGNAL - Raw data:", data);
    const { signal, fromUserID: senderId, callID: callID } = data;
    
    console.log("📡 [CALL] Processing signal:", signal.type, "from user:", senderId, "callID:", callID);
    
    let pc = peerConnectionRef.current;
    if (!pc) {
      console.log("🔄 [CALL] Creating new PeerConnection for incoming signal");
      await setupWebRTC({ isCaller: false, targetUserId: senderId, callID });
      pc = peerConnectionRef.current;
    }

    try {
      if (signal.type === 'offer') {
        console.log("🔄 [CALL] Processing OFFER from user:", senderId);
        await setRemoteDescription(pc, { 
          type: 'offer', 
          sdp: signal.sdp 
        });
        const answer = await createAnswer(pc);
        console.log("📤 [CALL SOCKET] Sending ANSWER back to user:", senderId);
        sendSignal(senderId, callID, { 
          type: 'answer', 
          sdp: answer.sdp  
        });
      }
      else if (signal.type === 'answer') {
        console.log("✅ [CALL] Processing ANSWER from user:", senderId);
        await setRemoteDescription(pc, { 
          type: 'answer', 
          sdp: signal.sdp  
        });
        setCallStatus('ongoing');
        startTimer();
      }
      else if (signal.type === 'candidate') {
        console.log("❄️ [CALL] Processing ICE candidate from user:", senderId);
        await addIceCandidate(pc, signal.candidate); 
      }
    } catch (err) {
      console.error('❌ [CALL] Signal handling error:', err);
    }
  };

  // STOMP Subscriptions - CALL ONLY
  useEffect(() => {
    if (!isConnected || !subscribe) {
      console.log("🔌 [CALL SOCKET] Socket not ready for call subscriptions");
      return;
    }

    console.log("🔔 [CALL SOCKET] Setting up CALL subscriptions...");

    const unsubs = [
      subscribe('/user/queue/call.incoming', (data) => {
        console.log("📞 [CALL SOCKET] INCOMING CALL received:", data);
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        toast(`Cuộc gọi từ ${data.initiatorName || 'Ai đó'}`, { duration: 10000 });
      }),

      subscribe('/user/queue/call.answered', (data) => {
        console.log("✅ [CALL SOCKET] CALL ANSWERED received:", data);
        setCallStatus('ongoing');
        setIsReceivingCall(false);
        startTimer();
      }),

      subscribe('/user/queue/call.ended', (data) => {
        console.log("📵 [CALL SOCKET] CALL ENDED received:", data);
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }),

      subscribe('/user/queue/call.rejected', (data) => {
        console.log("❌ [CALL SOCKET] CALL REJECTED received:", data);
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }),

      subscribe('/user/queue/call.signal', (data) => {
        console.log('🎯 [CALL SOCKET] CALL SIGNAL received:', data);
        handleSignal(data);
      }),

      subscribe('/user/queue/call.error', (data) => {
        console.error("🚨 [CALL SOCKET] CALL ERROR received:", data);
        toast.error(data.message || 'Lỗi cuộc gọi');
        cleanup();
      })
    ];

    console.log("✅ [CALL SOCKET] All call subscriptions set up");

    return () => {
      console.log("🧹 [CALL SOCKET] Unsubscribing from call topics");
      unsubs.forEach(unsub => unsub?.unsubscribe?.());
    };
  }, [isConnected, subscribe]);

  // ===== API CHO COMPONENT =====
  const initiateCall = async (receiverID, conversationID, fromUserID, type = 'video') => {
    try {
      console.log("🚀 [CALL] INITIATE CALL - receiver:", receiverID, "conversation:", conversationID, "fromUser:", fromUserID, "type:", type);
      
      // 🚨 LƯU fromUserID vào ref
      fromUserIDRef.current = fromUserID;

      setIsMakingCall(true);
      setCallType(type);

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;
      console.log("📞 [CALL] Call service response:", callData);

      setCall(callData);
      setCallStatus('ringing');

      const initiateMessage = {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        fromUserID: Number(fromUserID),
        type: type,
        conversationID: Number(conversationID)
      };
      
      console.log("📤 [CALL SOCKET] SENDING CALL INITIATE:", initiateMessage);
      sendMessage('/call.initiate', initiateMessage);

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        callType: type
      });

      return callData;

    } catch (err) {
      console.error("❌ [CALL] Lỗi khởi tạo cuộc gọi:", err);
      toast.error('Không thể thực hiện cuộc gọi');
      cleanup();
      setIsMakingCall(false);
      return null;
    }
  };

  const answerCall = async () => {
    if (!call) return;

    console.log("📞 [CALL] ANSWERING CALL - callID:", call.callID, "initiatorID:", call.initiatorID);
    
    await callService.answerCall(call.callID);

    const answerMessage = {
      callID: call.callID,
      initiatorID: call.initiatorID,
      accepted: true
    };
    
    console.log("📤 [CALL SOCKET] SENDING CALL ANSWER:", answerMessage);
    sendMessage('/call.answer', answerMessage);
  };

  const endCall = async () => {
    if (!call) return;
    
    console.log("📵 [CALL] ENDING CALL - callID:", call.callID);
    await callService.endCall(call.callID);
    cleanup();
  };

  const rejectCall = async () => {
    if (!call) return;

    console.log("❌ [CALL] REJECTING CALL - callID:", call.callID, "initiatorID:", call.initiatorID);
    
    await callService.rejectCall(call.callID);

    const rejectMessage = {
      callID: call.callID,
      initiatorID: call.initiatorID,
    };
    
    console.log("📤 [CALL SOCKET] SENDING CALL REJECT:", rejectMessage);
    sendMessage('/call.reject', rejectMessage);
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