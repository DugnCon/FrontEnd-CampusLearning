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
  const { isConnected, sendMessage, subscribe } = useSocket();

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

  const getCurrentUserID = () => fromUserIDRef.current;

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

    try {
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
        if (pc.iceConnectionState === 'failed') {
          toast.error('Connection failed');
          cleanup();
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          toast.error('Connection lost');
          cleanup();
        }
      };

      if (isCaller) {
        const offer = await createOffer(pc);
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      toast.error('Cannot access camera/microphone');
      cleanup();
      throw err;
    }
  };

  const handleWebRTCSignal = async (data) => {
    const { signal, callID } = data;
    if (callID !== currentCallIDRef.current) return;
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      switch (signal.type) {
        case 'offer':
          await setRemoteDescription(pc, { type: 'offer', sdp: signal.sdp });
          const answer = await createAnswer(pc);
          sendSignal({ type: 'answer', sdp: answer.sdp });
          break;
        case 'answer':
          await setRemoteDescription(pc, { type: 'answer', sdp: signal.sdp });
          setCallStatus('ongoing');
          startTimer();
          toast.success('Connected successfully');
          break;
        case 'candidate':
          await addIceCandidate(pc, signal.candidate);
          break;
      }
    } catch (err) {
      console.error('Signal processing error:', err);
    }
  };

  useEffect(() => {
    if (!isConnected || !subscribe || !fromUserIDRef.current) return;

    const myId = fromUserIDRef.current.toString();

    const unsubs = [
      subscribe(`/user/${myId}/queue/call.incoming`, (data) => {
        if (callStatus !== 'idle') {
          sendMessage('/call.reject', { callID: Number(data.callID), fromUserID: fromUserIDRef.current });
          return;
        }
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        currentCallIDRef.current = data.callID;
        targetUserIDRef.current = data.initiatorID;
        fromUserIDRef.current = data.receiverID;
        toast(`Call ${data.callType} from ${data.initiatorName || data.initiatorID}`);
      }),

      subscribe(`/user/${myId}/queue/call.answered`, () => {
        setIsReceivingCall(false);
        setCallStatus('connecting');
      }),

      subscribe(`/user/${myId}/queue/call.rejected`, () => {
        if (isMakingCall || isReceivingCall) {
          toast.error('Call rejected');
          cleanup();
        }
      }),

      subscribe(`/user/${myId}/queue/call.ended`, () => {
        if (callStatus === 'ongoing' || callStatus === 'connecting') {
          toast.success(`Call ended • ${formatDuration(callDuration)}`);
          cleanup();
        }
      }),

      subscribe(`/user/${myId}/queue/call.signal`, handleWebRTCSignal),

      subscribe(`/user/${myId}/queue/call.error`, (data) => {
        toast.error(data.message || 'Call error');
        cleanup();
      })
    ];

    return () => unsubs.forEach(u => u && u());
  }, [isConnected, subscribe, callStatus, isMakingCall, isReceivingCall, callDuration]);

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    if (callStatus !== 'idle') {
      toast.error('Already in call');
      return null;
    }

    try {
      setIsMakingCall(true);
      setCallType(type === 'audio' ? 'audio' : 'video');

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');
      currentCallIDRef.current = callData.callID;
      targetUserIDRef.current = receiverID;
      fromUserIDRef.current = callData.initiatorID;

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: type === 'audio' ? 'audio' : 'video',
        conversationID: Number(conversationID),
        fromUserID: callData.initiatorID
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: type === 'audio' ? 'audio' : 'video'
      });

      return callData;
    } catch (err) {
      toast.error('Cannot call');
      cleanup();
      return null;
    }
  };

  const answerCall = async () => {
    if (!call || callStatus !== 'ringing') {
      toast.error('Cannot answer');
      return;
    }

    setCallStatus('connecting');
    setIsReceivingCall(false);

    try {
      sendMessage('/call.answer', {
        callID: Number(call.callID),
        initiatorID: Number(call.initiatorID),
        accepted: true,
        fromUserID: fromUserIDRef.current
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
    } catch (err) {
      toast.error('Error answering');
      cleanup();
    }
  };

  const endCall = async () => {
    if (!call) return;

    try {
      await callService.endCall(call.callID);
      sendMessage('/call.end', {
        callID: Number(call.callID),
        fromUserID: fromUserIDRef.current
      });
    } catch (err) {
      console.error(err);
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;

    try {
      await callService.rejectCall(call.callID);
      sendMessage('/call.reject', {
        callID: Number(call.callID),
        fromUserID: fromUserIDRef.current
      });
    } catch (err) {
      console.error(err);
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
    formatDuration,
    peerConnection: peerConnectionRef.current,
    currentCallID: currentCallIDRef.current
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};