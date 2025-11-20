import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from './SocketContext';
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
  const currentCallIDRef = useRef(null);
  const targetUserIDRef = useRef(null);
  const fromUserIDRef = useRef(null);

  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cleanup = () => {
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
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !fromUserIDRef.current) return;

    const message = {
      toUserID: Number(targetUserIDRef.current),
      fromUserID: Number(fromUserIDRef.current),
      callID: Number(currentCallIDRef.current),
      signal: { type: signal.type }
    };

    if (signal.sdp) message.signal.sdp = signal.sdp;
    if (signal.candidate) message.signal.candidate = signal.candidate;

    sendMessage('/call.signal', message);
  };

  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    if (peerConnectionRef.current) {
      webrtcEndCall(peerConnectionRef.current, localStream);
    }

    const stream = await getLocalStream(true, type === 'video');
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    currentCallIDRef.current = callID;
    targetUserIDRef.current = targetUserId;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;
    addTracksToConnection(pc, stream);

    pc.ontrack = (e) => {
      const remote = e.streams[0];
      setRemoteStream(remote);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: 'candidate', candidate: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        toast.error('Kết nối bị ngắt');
        cleanup();
      }
    };

    if (isCaller) {
      const offer = await createOffer(pc);
      sendSignal({ type: 'offer', sdp: offer.sdp });
    }

    return pc;
  };

  const handleWebRTCSignal = async (data) => {
    const { signal, callID } = data;
    if (callID !== currentCallIDRef.current) return;

    let pc = peerConnectionRef.current;

    if (!pc && signal.type === 'offer') {
      await setupWebRTC({
        isCaller: false,
        targetUserId: data.fromUserID,
        callID: callID,
        type: callType
      });
      pc = peerConnectionRef.current;
    }

    if (!pc) return;

    try {
      if (signal.type === 'offer') {
        await setRemoteDescription(pc, { type: 'offer', sdp: signal.sdp });
        const answer = await createAnswer(pc);
        sendSignal({ type: 'answer', sdp: answer.sdp });
      } else if (signal.type === 'answer') {
        await setRemoteDescription(pc, { type: 'answer', sdp: signal.sdp });
        setCallStatus('ongoing');
        startTimer();
        toast.success('Đã kết nối!');
      } else if (signal.type === 'candidate') {
        await addIceCandidate(pc, signal.candidate);
      }
    } catch (err) {
      console.error('Signal error:', err);
    }
  };

  useEffect(() => {
    if (!isConnected || !subscribe || !user) return;

    const unsubs = [
      subscribe('/user/queue/call.incoming', (data) => {
        if (callStatus !== 'idle') {
          sendMessage('/call.reject', { callID: Number(data.callID) });
          return;
        }
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        currentCallIDRef.current = data.callID;
        targetUserIDRef.current = data.initiatorID;
        fromUserIDRef.current = user.id;
        toast.success(`Cuộc gọi ${data.callType} từ ${data.initiatorName || 'bạn bè'}`);
      }),

      subscribe('/user/queue/call.answered', async (data) => {
        if (!isMakingCall) return;
        setIsMakingCall(false);
        setCallStatus('connecting');

        await setupWebRTC({
          isCaller: true,
          targetUserId: targetUserIDRef.current,
          callID: currentCallIDRef.current,
          type: callType
        });
      }),

      subscribe('/user/queue/call.rejected', () => {
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }),

      subscribe('/user/queue/call.ended', () => {
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }),

      subscribe('/user/queue/call.signal', handleWebRTCSignal),

      subscribe('/user/queue/call.error', (data) => {
        toast.error(data.message || 'Lỗi cuộc gọi');
        cleanup();
      })
    ];

    return () => unsubs.forEach(u => u && u());
  }, [isConnected, subscribe, user, callStatus, isMakingCall, callDuration, callType]);

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    if (callStatus !== 'idle' || isMakingCall) {
      toast.error('Đang có cuộc gọi');
      return null;
    }

    try {
      const validatedType = type === 'audio' ? 'audio' : 'video';
      setIsMakingCall(true);
      setCallType(validatedType);

      const res = await callService.initiateCall(receiverID, conversationID, validatedType);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');
      currentCallIDRef.current = callData.callID;
      targetUserIDRef.current = receiverID;
      fromUserIDRef.current = user.id;

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: validatedType,
        conversationID: Number(conversationID),
        fromUserID: Number(user.id)
      });

      toast.success('Đang gọi...');
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

    sendMessage('/call.answer', {
      callID: Number(call.callID),
      initiatorID: Number(call.initiatorID),
      accepted: true
    });

    await callService.answerCall(call.callID);

    await setupWebRTC({
      isCaller: false,
      targetUserId: call.initiatorID,
      callID: call.callID,
      type: call.callType
    });

    setCallStatus('ongoing');
    startTimer();
    toast.success('Đã kết nối!');
  };

  const endCall = async () => {
    if (!call) return;
    try {
      await callService.endCall(call.callID);
      sendMessage('/call.end', { callID: Number(call.callID) });
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;
    try {
      await callService.rejectCall(call.callID);
      sendMessage('/call.reject', { callID: Number(call.callID) });
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