import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';
import {
  createPeerConnection,
  getLocalStream,
  addTracksToConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  endCall as webrtcEndCall
} from '../utils/webRTC';

export const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { isConnected, sendMessage, onCallEvent } = useSocket();
  const { user } = useAuth();

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
  const currentCallIDRef = useRef(null);
  const targetUserIDRef = useRef(null);
  const fromUserIDRef = useRef(null);

  // LOG STATE ĐỂ DEBUG
  useEffect(() => {
    console.log('%c[CALL STATE]', 'color: magenta; font-weight: bold;', {
      userID: user?.userID,
      status: callStatus,
      making: isMakingCall,
      receiving: isReceivingCall,
      callID: currentCallIDRef.current,
      target: targetUserIDRef.current
    });
  }, [callStatus, isMakingCall, isReceivingCall, call, user?.userID]);

  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    console.log('%c[TIMER] Bắt đầu đếm giờ', 'color: cyan;');
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1),1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cleanup = () => {
    console.log('%c[CLEANUP] Dọn dẹp hoàn toàn', 'color: red; font-weight: bold;');
    stopTimer();
    webrtcEndCall(peerConnectionRef.current, localStream);
    setCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    setCallDuration(0);
    setLocalStream(null);
    setRemoteStream(null);
    currentCallIDRef.current = null;
    targetUserIDRef.current = null;
    fromUserIDRef.current = null;
    peerConnectionRef.current = null;
  };

  const sendSignal = (signal) => {
    const currentUserID = user?.userID || fromUserIDRef.current;
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !currentUserID) return;

    const message = {
      toUserID: Number(targetUserIDRef.current),
      fromUserID: Number(currentUserID),
      callID: Number(currentCallIDRef.current),
      signal: { type: signal.type }
    };
    if (signal.sdp) message.signal.sdp = signal.sdp;
    if (signal.candidate) message.signal.candidate = signal.candidate;

    console.log('%c[SIGNAL →] Gửi', 'color: lime; font-weight: bold;', message);
    sendMessage('/call.signal', message);
  };

  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    console.log('%c[WebRTC] Setup', 'color: gold; font-weight: bold;', { isCaller, targetUserId, callID, type });

    if (peerConnectionRef.current) {
      webrtcEndCall(peerConnectionRef.current, localStream);
    }

    const stream = await getLocalStream(true, type === 'video');
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    currentCallIDRef.current = callID;
    targetUserIDRef.current = targetUserId;
    fromUserIDRef.current = user?.userID;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;
    addTracksToConnection(pc, stream);

    pc.ontrack = (e) => {
      console.log('%c[WebRTC] Remote track nhận được!', 'color: #ff00ff; font-weight: bold;');
      const remote = e.streams[0];
      setRemoteStream(remote);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

    pc.onicecandidate = (e) => e.candidate && sendSignal({ type: 'candidate', candidate: e.candidate });
    pc.oniceconnectionstatechange = () => console.log('%c[ICE] State:', 'color: yellow;', pc.iceConnectionState);
    pc.onconnectionstatechange = () => console.log('%c[WebRTC] Connection:', 'color: orange;', pc.connectionState);

    if (isCaller) {
      const offer = await createOffer(pc);
      sendSignal({ type: 'offer', sdp: offer.sdp });
    }

    return pc;
  };

  const handleWebRTCSignal = async (data) => {
    if (data.callID !== currentCallIDRef.current) return;
    const pc = peerConnectionRef.current;
    if (!pc) return;

    console.log('%c[SIGNAL ←] Nhận', 'color: cyan; font-weight: bold;', data.signal.type);

    try {
      switch (data.signal.type) {
        case 'offer':
          if (callStatus !== 'connecting') return;
          await setRemoteDescription(pc, data.signal);
          const answer = await createAnswer(pc);
          sendSignal({ type: 'answer', sdp: answer.sdp });
          break;
        case 'answer':
          await setRemoteDescription(pc, data.signal);
          setCallStatus('ongoing');
          startTimer();
          toast.success('Kết nối thành công!');
          break;
        case 'candidate':
          await addIceCandidate(pc, data.signal.candidate);
          break;
      }
    } catch (err) {
      console.error('%c[SIGNAL] Lỗi:', 'color: red;', err);
    }
  };

  // CHỈ CHẠY 1 LẦN KHI SOCKET KẾT NỐI – KHÔNG BAO GIỜ RE-SUBSCRIBE!!!
  useEffect(() => {
    if (!isConnected || !user?.userID) return;

    console.log('%c[CALL EVENTS] ĐĂNG KÝ LẦN ĐẦU & DUY NHẤT', 'color: #00ff00; font-weight: bold;');

    const unsubIncoming = onCallEvent('incoming', (data) => {
      console.log('%c[INCOMING] ←', 'color: #ff00ff; font-weight: bold;', data);

      if (data.initiatorID === user.userID) {
        console.log('%c[INCOMING] Bỏ qua – tự gọi mình', 'color: yellow;');
        return;
      }
      if (callStatus !== 'idle') {
        sendMessage('/call.reject', { callID: data.callID });
        return;
      }

      setCall(data);
      setCallType(data.callType || 'video');
      setCallStatus('ringing');
      setIsReceivingCall(true);
      currentCallIDRef.current = data.callID;
      targetUserIDRef.current = data.initiatorID;
      toast(`Cuộc gọi từ ${data.initiatorName || data.initiatorID}`);
    });

    const unsubAnswered = onCallEvent('answered', () => {
      console.log('%c[ANSWERED] Callee đã nhận!');
      setCallStatus('connecting');
      setIsReceivingCall(false);
    });

    const unsubRejected = onCallEvent('rejected', () => {
      toast.error('Bị từ chối');
      cleanup();
    });

    const unsubEnded = onCallEvent('ended', () => {
      toast.success(`Kết thúc • ${formatDuration(callDuration)}`);
      cleanup();
    });

    const unsubSignal = onCallEvent('signal', handleWebRTCSignal);
    const unsubError = onCallEvent('error', (d) => {
      toast.error(d.message || 'Lỗi cuộc gọi');
      cleanup();
    });

    return () => {
      console.log('%c[CALL EVENTS] Hủy đăng ký khi disconnect', 'color: gray;');
      unsubIncoming(); unsubAnswered(); unsubRejected(); unsubEnded(); unsubSignal(); unsubError();
    };
  }, [isConnected, user?.userID, sendMessage, onCallEvent]); // CHỈ CÁI NÀY THÔI!!!

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    if (callStatus !== 'idle') return toast.error('Đang bận');

    try {
      setIsMakingCall(true);
      setCallType(type === 'audio' ? 'audio' : 'video');

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;

      setCallStatus('calling');
      currentCallIDRef.current = callData.callID;
      targetUserIDRef.current = receiverID;

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: type === 'audio' ? 'audio' : 'video',
        conversationID: Number(conversationID),
        fromUserID: Number(user.userID)
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: type === 'audio' ? 'audio' : 'video'
      });

      return callData;
    } catch (err) {
      toast.error('Không thể gọi');
      cleanup();
      return null;
    }
  };

  const answerCall = async () => {
    if (!call || callStatus !== 'ringing') return;

    setCallStatus('connecting');
    setIsReceivingCall(false);

    try {
      await setupWebRTC({
        isCaller: false,
        targetUserId: call.initiatorID,
        callID: call.callID,
        type: call.callType
      });

      sendMessage('/call.answer', {
        callID: Number(call.callID),
        initiatorID: Number(call.initiatorID),
        accepted: true,
        fromUserID: Number(user.userID)
      });

      await callService.answerCall(call.callID);
    } catch (err) {
      toast.error('Lỗi nhận cuộc gọi');
      cleanup();
    }
  };

  const endCall = async () => {
    if (!currentCallIDRef.current) return;
    try {
      await callService.endCall(currentCallIDRef.current);
      sendMessage('/call.end', { callID: currentCallIDRef.current, fromUserID: user.userID });
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;
    try {
      await callService.rejectCall(call.callID);
      sendMessage('/call.reject', { callID: call.callID, fromUserID: user.userID });
    } finally {
      cleanup();
    }
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