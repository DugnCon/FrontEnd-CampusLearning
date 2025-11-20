import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';

// WebRTC Utils - CHỈ DÙNG HÀM, KHÔNG DÙNG CALLBACK NỮA
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
  const { isConnected, user, sendMessage, subscribe } = useSocket();

  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isMakingCall, setIsMakingCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);

  // LƯU fromUserID ĐÚNG LUÔN
  const fromUserIDRef = useRef(null);
  const targetUserIDRef = useRef(null);
  const currentCallIDRef = useRef(null);

  // GỬI SIGNAL – BẢO ĐẢM fromUserID LUÔN CÓ
  const sendSignal = (signal) => {
    if (!isConnected) {
      console.log("Socket not connected, cannot send signal");
      return;
    }

    const message = {
      toUserID: targetUserIDRef.current?.toString(),
      fromUserID: fromUserIDRef.current || user?.id || user?.userID || user?.userId,
      callID: currentCallIDRef.current,
      signal: {
        type: signal.type
      }
    };

    if (signal.sdp) message.signal.sdp = signal.sdp;
    if (signal.candidate) message.signal.candidate = signal.candidate;

    console.log("GỬI SIGNAL THÀNH CÔNG:", {
      to: message.toUserID,
      from: message.fromUserID,   // BÂY GIỜ LUÔN CÓ!!!
      callID: message.callID,
      type: signal.type
    });

    sendMessage('/call.signal', message);
  };

  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const cleanup = () => {
    console.log("CLEANUP CALL");
    setCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    setCallDuration(0);
    fromUserIDRef.current = null;
    targetUserIDRef.current = null;
    currentCallIDRef.current = null;

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

  // SETUP WEBRTC – GỌI TRỰC TIẾP sendSignal (KHÔNG DÙNG CALLBACK)
  const setupWebRTC = async ({ isCaller = false, targetUserId, callID, callType }) => {
    try {
      console.log("SETUP WEBRTC - isCaller:", isCaller);

      const stream = await getLocalStream(true, callType === 'video');
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // LƯU LẠI ĐỂ sendSignal DÙNG
      targetUserIDRef.current = targetUserId;
      currentCallIDRef.current = callID;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          console.log("REMOTE VIDEO ĐÃ HIỆN!!!");
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE STATE:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          console.log("KẾT NỐI WEBRTC THÀNH CÔNG!!!");
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({
            type: 'candidate',
            candidate: e.candidate.toJSON()
          });
        }
      };

      if (isCaller) {
        await new Promise(r => setTimeout(r, 500));
        const offer = await createOffer(pc);
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      console.error("WebRTC setup error:", err);
      toast.error('Không thể truy cập mic/camera');
      cleanup();
      throw err;
    }
  };

  const handleSignal = async (data) => {
    const { signal, fromUserID: senderId, callID } = data;
    console.log("NHẬN SIGNAL TỪ", senderId, ":", signal.type);

    let pc = peerConnectionRef.current;
    if (!pc) {
      await setupWebRTC({
        isCaller: false,
        targetUserId: senderId,
        callID,
        callType: callType || 'video'
      });
      pc = peerConnectionRef.current;
    }

    try {
      if (signal.type === 'offer') {
        await setRemoteDescription(pc, { type: 'offer', sdp: signal.sdp });
        const answer = await createAnswer(pc);
        sendSignal({ type: 'answer', sdp: answer.sdp });
      } else if (signal.type === 'answer') {
        await setRemoteDescription(pc, { type: 'answer', sdp: signal.sdp });
        setCallStatus('ongoing');
        startTimer();
      } else if (signal.type === 'candidate') {
        await addIceCandidate(pc, signal.candidate);
      }
    } catch (err) {
      console.error("Signal handling error:", err);
    }
  };

  // SUBSCRIPTIONS – DÙNG subscribe TỪ CONTEXT
  useEffect(() => {
    if (!isConnected || !subscribe) return;

    const unsubs = [
      subscribe('/user/queue/call.incoming', (data) => {
        console.log("CUỘC GỌI ĐẾN TỪ:", data.initiatorName);
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        toast(`Cuộc gọi từ ${data.initiatorName}`, { duration: 10000 });
      }),

      subscribe('/user/queue/call.answered', () => {
        setCallStatus('ongoing');
        setIsReceivingCall(false);
        startTimer();
      }),

      subscribe('/user/queue/call.rejected', () => {
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }),

      subscribe('/user/queue/call.ended', () => {
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }),

      subscribe('/user/queue/call.signal', (data) => {
        console.log('NHẬN ĐƯỢC SIGNAL WEBRTC:', data);
        handleSignal(data);
      }),

      subscribe('/user/queue/call.error', (data) => {
        toast.error(data.message || 'Lỗi cuộc gọi');
        cleanup();
      })
    ];

    return () => unsubs.forEach(u => u?.unsubscribe?.());
  }, [isConnected, subscribe]);

  // API
  const initiateCall = async (receiverID, conversationID, fromUserID, type = 'video') => {
    try {
      console.log("BẮT ĐẦU GỌI CHO", receiverID, "TỪ", fromUserID);
      fromUserIDRef.current = fromUserID;
      setIsMakingCall(true);
      setCallType(type);

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        fromUserID: Number(fromUserID),
        type,
        conversationID: Number(conversationID)
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        callType: type
      });

      return callData;
    } catch (err) {
      toast.error('Không thể thực hiện cuộc gọi');
      cleanup();
      setIsMakingCall(false);
      return null;
    }
  };

  const answerCall = async () => {
    if (!call) return;
    await callService.answerCall(call.callID);
    sendMessage('/call.answer', { callID: call.callID, initiatorID: call.initiatorID, accepted: true });
  };

  const endCall = async () => {
    if (!call) return;
    await callService.endCall(call.callID);
    cleanup();
  };

  const rejectCall = async () => {
    if (!call) return;
    await callService.rejectCall(call.callID);
    sendMessage('/call.reject', { callID: call.callID, initiatorID: call.initiatorID });
    cleanup();
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