import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
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
  const callTimeoutRef = useRef(null);

  useEffect(() => {
    console.log('CALL STATE CHANGE', {
      userID: user?.userID,
      callStatus,
      isMakingCall,
      isReceivingCall,
      callID: currentCallIDRef.current,
      targetID: targetUserIDRef.current,
      callData: call
    });
  }, [callStatus, isMakingCall, isReceivingCall, call, user?.userID]);

  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    console.log('CALL Bắt đầu đếm giờ');
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      console.log('CALL Dừng đếm giờ');
    }
  };

  const cleanup = useCallback(() => {
    console.log('CALL CLEANUP – Dọn dẹp hoàn toàn');
    stopTimer();
    
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
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
  }, [localStream]);

  const sendSignal = useCallback((signal) => {
    const currentUserID = user?.userID || fromUserIDRef.current;
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !currentUserID) {
      console.log('SIGNAL Không gửi được – thiếu điều kiện', { isConnected, callID: currentCallIDRef.current, target: targetUserIDRef.current, userID: currentUserID });
      return;
    }

    const message = {
      toUserID: Number(targetUserIDRef.current),
      fromUserID: Number(currentUserID),
      callID: Number(currentCallIDRef.current),
      signal: { type: signal.type }
    };
    if (signal.sdp) message.signal.sdp = signal.sdp;
    if (signal.candidate) message.signal.candidate = signal.candidate;

    console.log('SIGNAL Gửi signal', message);
    sendMessage('/call.signal', message);
  }, [isConnected, user?.userID, sendMessage]);

  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    console.log('WebRTC Bắt đầu setupWebRTC', { isCaller, targetUserId, callID, type });

    if (peerConnectionRef.current) {
      webrtcEndCall(peerConnectionRef.current, localStream);
    }

    try {
      const stream = await getLocalStream(true, type === 'video');
      console.log('WebRTC Lấy local stream thành công', stream);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      currentCallIDRef.current = callID;
      targetUserIDRef.current = targetUserId;
      fromUserIDRef.current = user?.userID;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        console.log('WebRTC Nhận remote track!', e.streams[0]);
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('ICE Gửi candidate', e.candidate.candidate.substring(0, 50) + '...');
          sendSignal({ type: 'candidate', candidate: e.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE iceConnectionState:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('WebRTC connectionState:', pc.connectionState);
      };

      if (isCaller) {
        console.log('WebRTC Là caller → tạo offer');
        const offer = await createOffer(pc);
        console.log('SDP Gửi offer', offer.sdp.substring(0, 100) + '...');
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      console.error('WebRTC Lỗi setupWebRTC', err);
      toast.error('Không thể truy cập camera/micro');
      cleanup();
      throw err;
    }
  };

  const handleWebRTCSignal = useCallback(async (data) => {
    console.log('SIGNAL Nhận signal', data);

    const { signal, callID } = data;
    if (callID !== currentCallIDRef.current) {
      console.log('SIGNAL Bỏ qua – callID không khớp', { received: callID, current: currentCallIDRef.current });
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('SIGNAL Không có PeerConnection');
      return;
    }

    try {
      switch (signal.type) {
        case 'offer':
          console.log('SIGNAL Nhận offer – đang ở trạng thái:', callStatus);
          if (callStatus !== 'connecting') {
            console.log('SIGNAL Bỏ qua offer – không phải connecting');
            return;
          }
          await setRemoteDescription(pc, { type: 'offer', sdp: signal.sdp });
          console.log('SDP Đã set remote description (offer)');
          const answer = await createAnswer(pc);
          console.log('SDP Gửi answer', answer.sdp.substring(0, 100) + '...');
          sendSignal({ type: 'answer', sdp: answer.sdp });
          break;

        case 'answer':
          console.log('SIGNAL Nhận answer → kết nối thành công!');
          await setRemoteDescription(pc, { type: 'answer', sdp: signal.sdp });
          setCallStatus('ongoing');
          startTimer();
          toast.success('Đã kết nối!');
          break;

        case 'candidate':
          await addIceCandidate(pc, signal.candidate);
          console.log('ICE Đã thêm candidate');
          break;

        default:
          console.warn('Unknown signal type:', signal.type);
      }
    } catch (err) {
      console.error('SIGNAL Lỗi xử lý signal', err);
    }
  }, [callStatus, sendSignal]);

  useEffect(() => {
    if (!isConnected) {
      console.log('SOCKET Chưa kết nối – không subscribe call events');
      return;
    }

    console.log('CALL EVENTS Đã kết nối – đăng ký các event');

    const unsubscribeCallIncoming = onCallEvent('incoming', (data) => {
      console.log('INCOMING Nhận incoming call!', data);

      if (data.initiatorID === user?.userID) {
        console.log('INCOMING Đây là cuộc gọi do chính mình khởi tạo → BỎ QUA');
        return;
      }

      if (callStatus !== 'idle') {
        console.log('INCOMING Đang bận → từ chối');
        sendMessage('/call.reject', { callID: Number(data.callID) });
        return;
      }

      console.log('INCOMING Cuộc gọi hợp lệ → đổ chuông!');
      setCall(data);
      setCallType(data.callType || 'video');
      setCallStatus('ringing');
      setIsReceivingCall(true);
      currentCallIDRef.current = data.callID;
      targetUserIDRef.current = data.initiatorID;
      toast(`Cuộc gọi từ ${data.initiatorName || data.initiatorID}`);
    });

    const unsubscribeCallAnswered = onCallEvent('answered', (data) => {
      console.log('ANSWERED Cuộc gọi được chấp nhận!', data);
      setCallStatus('connecting');
      setIsReceivingCall(false);
    });

    const unsubscribeCallRejected = onCallEvent('rejected', (data) => {
      console.log('REJECTED Cuộc gọi bị từ chối', data);
      if (isMakingCall || isReceivingCall) {
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }
    });

    const unsubscribeCallEnded = onCallEvent('ended', (data) => {
      console.log('ENDED Cuộc gọi kết thúc', data);
      if (callStatus === 'ongoing' || callStatus === 'connecting') {
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }
    });

    const unsubscribeCallSignal = onCallEvent('signal', handleWebRTCSignal);
    const unsubscribeCallError = onCallEvent('error', (data) => {
      console.error('ERROR Lỗi call:', data);
      toast.error(data.message || 'Lỗi cuộc gọi');
      cleanup();
    });

    return () => {
      console.log('CALL EVENTS Dọn dẹp subscriptions');
      unsubscribeCallIncoming();
      unsubscribeCallAnswered();
      unsubscribeCallRejected();
      unsubscribeCallEnded();
      unsubscribeCallSignal();
      unsubscribeCallError();
    };
  }, [isConnected, callStatus, isMakingCall, isReceivingCall, callDuration, sendMessage, onCallEvent, user?.userID, handleWebRTCSignal, cleanup]);

  useEffect(() => {
    return () => {
      console.log('CallProvider Unmount - cleanup tất cả');
      cleanup();
    };
  }, [cleanup]);

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    console.log('CALL Bắt đầu gọi →', { receiverID, conversationID, type });

    if (callStatus !== 'idle') {
      toast.error('Đang trong cuộc gọi khác');
      return null;
    }

    try {
      const validatedType = type === 'audio' ? 'audio' : 'video';
      setIsMakingCall(true);
      setCallType(validatedType);

      const res = await callService.initiateCall(receiverID, conversationID, validatedType);
      const callData = res.call || res;

      console.log('CALL Tạo call thành công:', callData);

      setCallStatus('calling');
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

      console.log('CALL Đã gửi /call.initiate + setup WebRTC (caller)');

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: validatedType
      });

      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'calling') {
          console.log('CALL Timeout - không có phản hồi');
          toast.error('Không có phản hồi từ người nhận');
          cleanup();
        }
      }, 30000);

      return callData;
    } catch (err) {
      console.error('CALL Lỗi initiateCall', err);
      toast.error('Không thể gọi');
      cleanup();
      return null;
    } finally {
      setIsMakingCall(false);
    }
  };

  const answerCall = async () => {
    if (!call || callStatus !== 'ringing') {
      console.log('ANSWER Không thể nhận – trạng thái sai', { callStatus, call: !!call });
      return;
    }

    console.log('ANSWER Nhận cuộc gọi!');

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
      console.log('ANSWER Đã chấp nhận cuộc gọi – chờ answer SDP...');
    } catch (err) {
      console.error('ANSWER Lỗi answerCall', err);
      toast.error('Lỗi khi nhận cuộc gọi');
      cleanup();
    }
  };

  const endCall = async () => {
    console.log('END Kết thúc cuộc gọi');
    
    if (!currentCallIDRef.current) {
      console.log('END Không có callID → cleanup thôi');
      cleanup();
      return;
    }

    try {
      await callService.endCall(currentCallIDRef.current);
      sendMessage('/call.end', { 
        callID: Number(currentCallIDRef.current), 
        fromUserID: Number(user?.userID) 
      });
    } catch (err) {
      console.error('End call error:', err);
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    console.log('REJECT Từ chối cuộc gọi');
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