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

  const getCurrentUserID = () => {
    return user?.userID || fromUserIDRef.current;
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
    const currentUserID = getCurrentUserID();
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !currentUserID) return;

    const message = {
      toUserID: Number(targetUserIDRef.current),
      fromUserID: Number(currentUserID),
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
      fromUserIDRef.current = user?.userID;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ type: 'candidate', candidate: e.candidate });
        }
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
          if (callStatus !== 'connecting') {
            console.log("Ignored offer - not in connecting state");
            return;
          }
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
        default:
          console.warn('Unknown signal type:', signal.type);
      }
    } catch (err) {
      console.error('Signal processing error:', err);
    }
  };

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeCallIncoming = onCallEvent('incoming', (data) => {

      if (data.initiatorID === user?.userID) {
        console.log("Ignored self-incoming call"); // caller nhận incoming của chính mình → bỏ qua
        return;
      }

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
      fromUserIDRef.current = data.receiverID;
      toast(`Call ${data.callType} from ${data.initiatorName}`);
    });

    const unsubscribeCallAnswered = onCallEvent('answered', (data) => {
      setCallStatus('connecting');
      setIsReceivingCall(false);
    });

    const unsubscribeCallRejected = onCallEvent('rejected', (data) => {
      if (isMakingCall || isReceivingCall) {
        toast.error('Call rejected');
        cleanup();
      }
    });

    const unsubscribeCallEnded = onCallEvent('ended', (data) => {
      if (callStatus === 'ongoing' || callStatus === 'connecting') {
        toast.success(`Call ended • ${formatDuration(callDuration)}`);
        cleanup();
      }
    });

    const unsubscribeCallSignal = onCallEvent('signal', handleWebRTCSignal);

    const unsubscribeCallError = onCallEvent('error', (data) => {
      toast.error(data.message || 'Call error');
      cleanup();
    });

    return () => {
      unsubscribeCallIncoming();
      unsubscribeCallAnswered();
      unsubscribeCallRejected();
      unsubscribeCallEnded();
      unsubscribeCallSignal();
      unsubscribeCallError();
    };
  }, [isConnected, callStatus, isMakingCall, isReceivingCall, callDuration, sendMessage, onCallEvent]);

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    if (callStatus !== 'idle') {
      toast.error('Already in call');
      return null;
    }

    if (isMakingCall) {
      toast.error('Processing call...');
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
      fromUserIDRef.current = user?.userID;

      sendMessage('/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: validatedType,
        conversationID: Number(conversationID),
        fromUserID: Number(user?.userID)
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: validatedType
      });

      return callData;
    } catch (err) {
      toast.error('Cannot call');
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
        fromUserID: Number(user?.userID)
      });

      await callService.answerCall(call.callID);
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
      sendMessage('/call.end', { callID: Number(call.callID), fromUserID: Number(user?.userID) });
    } catch (err) {
      console.error('End call error:', err);
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;
    try {
      await callService.rejectCall(call.callID);
      sendMessage('/call.reject', { callID: Number(call.callID), fromUserID: Number(user?.userID) });
    } catch (err) {
      console.error('Reject call error:', err);
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