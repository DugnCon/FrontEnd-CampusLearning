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

  // LOG MỌI THỨ ĐỂ MÀY BIẾT CHÍNH XÁC AI ĐANG LÀM GÌ
  useEffect(() => {
    console.log('%c[CALL STATE CHANGE]', 'color: #ff00ff; font-weight: bold;', {
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
    console.log('%c[CALL] Bắt đầu đếm giờ', 'color: cyan; font-weight: bold;');
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      console.log('%c[CALL] Dừng đếm giờ', 'color: orange;');
    }
  };

  const cleanup = () => {
    console.log('%c[CALL] CLEANUP – Dọn dẹp hoàn toàn', 'color: red; font-weight: bold;');
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
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !currentUserID) {
      console.log('%c[SIGNAL] Không gửi được – thiếu điều kiện', 'color: gray;', { isConnected, callID: currentCallIDRef.current, target: targetUserIDRef.current, userID: currentUserID });
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

    console.log('%c[SIGNAL] Gửi signal', 'color: #00ff00; font-weight: bold;', message);
    sendMessage('/call.signal', message);
  };

  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    console.log('%c[WebRTC] Bắt đầu setupWebRTC', 'color: #ffd700; font-weight: bold;', { isCaller, targetUserId, callID, type });

    if (peerConnectionRef.current) {
      webrtcEndCall(peerConnectionRef.current, localStream);
    }

    try {
      const stream = await getLocalStream(true, type === 'video');
      console.log('%c[WebRTC] Lấy local stream thành công', 'color: lime;', stream);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      currentCallIDRef.current = callID;
      targetUserIDRef.current = targetUserId;
      fromUserIDRef.current = user?.userID;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        console.log('%c[WebRTC] Nhận remote track!', 'color: #ff00ff; font-weight: bold;', e.streams[0]);
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('%c[ICE] Gửi candidate', 'color: cyan;', e.candidate.candidate.substring(0, 50) + '...');
          sendSignal({ type: 'candidate', candidate: e.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('%c[ICE] iceConnectionState:', 'color: yellow;', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('%c[WebRTC] connectionState:', 'color: #ff6600;', pc.connectionState);
      };

      if (isCaller) {
        console.log('%c[WebRTC] Là caller → tạo offer', 'color: red; font-weight: bold;');
        const offer = await createOffer(pc);
        console.log('%c[SDP] Gửi offer', 'color: red;', offer.sdp.substring(0, 100) + '...');
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      console.error('%c[WebRTC] Lỗi setupWebRTC', 'color: red;', err);
      toast.error('Không thể truy cập camera/micro');
      cleanup();
      throw err;
    }
  };

  const handleWebRTCSignal = async (data) => {
    console.log('%c[SIGNAL] Nhận signal', 'color: #00ffff; font-weight: bold;', data);

    const { signal, callID } = data;
    if (callID !== currentCallIDRef.current) {
      console.log('%c[SIGNAL] Bỏ qua – callID không khớp', 'color: gray;', { received: callID, current: currentCallIDRef.current });
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('%c[SIGNAL] Không có PeerConnection', 'color: gray;');
      return;
    }

    try {
      switch (signal.type) {
        case 'offer':
          console.log('%c[SIGNAL] Nhận offer – đang ở trạng thái:', 'color: #ff00ff;', callStatus);
          if (callStatus !== 'connecting') {
            console.log('%c[SIGNAL] Bỏ qua offer – không phải connecting', 'color: orange;');
            return;
          }
          await setRemoteDescription(pc, { type: 'offer', sdp: signal.sdp });
          console.log('%c[SDP] Đã set remote description (offer)');
          const answer = await createAnswer(pc);
          console.log('%c[SDP] Gửi answer', 'color: green;', answer.sdp.substring(0, 100) + '...');
          sendSignal({ type: 'answer', sdp: answer.sdp });
          break;

        case 'answer':
          console.log('%c[SIGNAL] Nhận answer → kết nối thành công!', 'color: #00ff00; font-weight: bold;');
          await setRemoteDescription(pc, { type: 'answer', sdp: signal.sdp });
          setCallStatus('ongoing');
          startTimer();
          toast.success('Đã kết nối!');
          break;

        case 'candidate':
          await addIceCandidate(pc, signal.candidate);
          console.log('%c[ICE] Đã thêm candidate');
          break;

        default:
          console.warn('Unknown signal type:', signal.type);
      }
    } catch (err) {
      console.error('%c[SIGNAL] Lỗi xử lý signal', 'color: red;', err);
    }
  };

  useEffect(() => {
    if (!isConnected) {
      console.log('%c[SOCKET] Chưa kết nối – không subscribe call events', 'color: gray;');
      return;
    }

    console.log('%c[CALL EVENTS] Đã kết nối – đăng ký các event', 'color: #ffd700; font-weight: bold;');

    const unsubscribeCallIncoming = onCallEvent('incoming', (data) => {
      console.log('%c[INCOMING] Nhận incoming call!', 'color: #ff00ff; font-weight: bold;', data);

      if (data.initiatorID === user?.userID) {
        console.log('%c[INCOMING] Đây là cuộc gọi do chính mình khởi tạo → BỎ QUA', 'color: yellow; font-weight: bold;');
        return;
      }

      if (callStatus !== 'idle') {
        console.log('%c[INCOMING] Đang bận → từ chối', 'color: orange;');
        sendMessage('/call.reject', { callID: Number(data.callID) });
        return;
      }

      console.log('%c[INCOMING] Cuộc gọi hợp lệ → đổ chuông!', 'color: #00ff00; font-weight: bold;');
      setCall(data);
      setCallType(data.callType || 'video');
      setCallStatus('ringing');
      setIsReceivingCall(true);
      currentCallIDRef.current = data.callID;
      targetUserIDRef.current = data.initiatorID;
      toast(`Cuộc gọi từ ${data.initiatorName || data.initiatorID}`);
    });

    const unsubscribeCallAnswered = onCallEvent('answered', (data) => {
      console.log('%c[ANSWERED] Cuộc gọi được chấp nhận!', 'color: #00ff00; font-weight: bold;', data);
      setCallStatus('connecting');
      setIsReceivingCall(false);
    });

    const unsubscribeCallRejected = onCallEvent('rejected', (data) => {
      console.log('%c[REJECTED] Cuộc gọi bị từ chối', 'color: red;', data);
      if (isMakingCall || isReceivingCall) {
        toast.error('Cuộc gọi bị từ chối');
        cleanup();
      }
    });

    const unsubscribeCallEnded = onCallEvent('ended', (data) => {
      console.log('%c[ENDED] Cuộc gọi kết thúc', 'color: red; font-weight: bold;', data);
      if (callStatus === 'ongoing' || callStatus === 'connecting') {
        toast.success(`Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
        cleanup();
      }
    });

    const unsubscribeCallSignal = onCallEvent('signal', handleWebRTCSignal);
    const unsubscribeCallError = onCallEvent('error', (data) => {
      console.error('%c[ERROR] Lỗi call:', 'color: red;', data);
      toast.error(data.message || 'Lỗi cuộc gọi');
      cleanup();
    });

    return () => {
      console.log('%c[CALL EVENTS] Dọn dẹp subscriptions', 'color: gray;');
      unsubscribeCallIncoming();
      unsubscribeCallAnswered();
      unsubscribeCallRejected();
      unsubscribeCallEnded();
      unsubscribeCallSignal();
      unsubscribeCallError();
    };
  }, [isConnected, callStatus, isMakingCall, isReceivingCall, callDuration, sendMessage, onCallEvent, user?.userID]);

  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    console.log('%c[CALL] Bắt đầu gọi →', 'color: #ff6600; font-weight: bold;', { receiverID, conversationID, type });

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

      console.log('%c[CALL] Tạo call thành công:', 'color: green; font-weight: bold;', callData);

      // CHỈ SET TRẠNG THÁI CALLING – KHÔNG SET CALL, KHÔNG RINGING!!!
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

      console.log('%c[CALL] Đã gửi /call.initiate + setup WebRTC (caller)', 'color: #ff00ff;');

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: validatedType
      });

      return callData;
    } catch (err) {
      console.error('%c[CALL] Lỗi initiateCall', 'color: red;', err);
      toast.error('Không thể gọi');
      cleanup();
      return null;
    }
  };

  const answerCall = async () => {
    if (!call || callStatus !== 'ringing') {
      console.log('%c[ANSWER] Không thể nhận – trạng thái sai', 'color: orange;', { callStatus, call: !!call });
      return;
    }

    console.log('%c[ANSWER] Nhận cuộc gọi!', 'color: #00ff00; font-weight: bold;');

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
      console.log('%c[ANSWER] Đã chấp nhận cuộc gọi – chờ answer SDP...', 'color: cyan;');
    } catch (err) {
      console.error('%c[ANSWER] Lỗi answerCall', 'color: red;', err);
      toast.error('Lỗi khi nhận cuộc gọi');
      cleanup();
    }
  };

  const endCall = async () => {
    console.log('%c[END] Kết thúc cuộc gọi', 'color: red; font-weight: bold;');
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
    console.log('%c[REJECT] Từ chối cuộc gọi', 'color: orange; font-weight: bold;');
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