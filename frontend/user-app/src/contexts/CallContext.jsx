import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from 'react';
import { useSocket } from './SocketContext';
import callService from '../services/callService';
import { toast } from 'react-hot-toast';

// WebRTC Utils - chỉ dùng hàm thuần
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

  // States
  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, ringing, connecting, ongoing, ended
  const [callType, setCallType] = useState(null); // 'video' | 'voice'
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [isMakingCall, setIsMakingCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const currentCallIDRef = useRef(null);
  const initiatorIDRef = useRef(null); // Dành cho người nhận cuộc gọi

  // Đảm bảo user ID luôn có
  const currentUserId = user?.id || user?.userID || user?.userId;

  const formatDuration = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    console.log('CLEANUP CALL - FULL RESET');

    setCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIsReceivingCall(false);
    setIsMakingCall(false);
    setCallDuration(0);
    setLocalStream(null);
    setRemoteStream(null);

    currentCallIDRef.current = null;
    initiatorIDRef.current = null;

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopTimer();
  }, [localStream]);

  // Gửi signal qua socket
  const sendSignal = useCallback(
    (signal) => {
      if (!isConnected || !currentCallIDRef.current) {
        console.warn('Không thể gửi signal: socket chưa kết nối hoặc không có callID');
        return;
      }

      const message = {
        toUserID: initiatorIDRef.current?.toString(),
        fromUserID: currentUserId?.toString(),
        callID: currentCallIDRef.current,
        signal: { type: signal.type },
      };

      if (signal.sdp) message.signal.sdp = signal.sdp;
      if (signal.candidate) message.signal.candidate = signal.candidate;

      console.log('GỬI SIGNAL:', signal.type, 'CallID:', currentCallIDRef.current);
      sendMessage('/app/call.signal', message);
    },
    [isConnected, currentUserId, sendMessage]
  );

  // Setup WebRTC (gọi khi bắt đầu gọi HOẶC khi NHẤN NGHE MÁY)
  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    if (peerConnectionRef.current) {
      console.warn('PeerConnection đã tồn tại, bỏ qua setup lại');
      return peerConnectionRef.current;
    }

    try {
      console.log('SETUP WEBRTC - isCaller:', isCaller);

      const stream = await getLocalStream(true, type === 'video');
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Lưu thông tin để gửi signal
      currentCallIDRef.current = callID;
      if (!isCaller) initiatorIDRef.current = targetUserId;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      addTracksToConnection(pc, stream);

      pc.ontrack = (e) => {
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          console.log('REMOTE STREAM ĐÃ HIỆN!');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE State:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          toast.error('Kết nối WebRTC thất bại');
          cleanup();
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({
            type: 'candidate',
            candidate: e.candidate.toJSON(),
          });
        }
      };

      if (isCaller) {
        const offer = await createOffer(pc);
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      console.error('WebRTC setup error:', err);
      toast.error('Không thể truy cập mic/camera');
      cleanup();
      throw err;
    }
  };

  // Xử lý signal từ đối phương
  const handleSignal = useCallback(
    async (data) => {
      const { signal, callID } = data;

      // Bỏ qua nếu không cùng callID
      if (callID !== currentCallIDRef.current) {
        console.log('Bỏ qua signal không cùng callID');
        return;
      }

      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('Nhận signal nhưng chưa có PeerConnection');
        return;
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
        console.error('Lỗi xử lý signal:', err);
      }
    },
    [sendSignal]
  );

  // Socket listeners
  useEffect(() => {
    if (!isConnected || !subscribe || !currentUserId) return;

    const unsubs = [
      subscribe('/user/queue/call.incoming', (data) => {
        // Chỉ chấp nhận nếu đang idle
        if (callStatus !== 'idle') {
          sendMessage('/app/call.reject', { callID: data.callID });
          return;
        }

        console.log('CUỘC GỌI ĐẾN TỪ:', data.initiatorName);
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        currentCallIDRef.current = data.callID;
        initiatorIDRef.current = data.initiatorID;

        toast(`Cuộc gọi ${data.callType === 'video' ? 'video' : 'thoại'} từ ${data.initiatorName}`, {
          duration: 15000,
        });
      }),

      subscribe('/user/queue/call.answered', () => {
        setCallStatus('connecting');
        setIsReceivingCall(false);
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
        handleSignal(data);
      }),

      subscribe('/user/queue/call.error', (data) => {
        toast.error(data.message || 'Lỗi cuộc gọi');
        cleanup();
      }),
    ];

    return () => {
      unsubs.forEach((u) => u?.unsubscribe?.());
    };
  }, [isConnected, subscribe, currentUserId, callStatus, handleSignal, callDuration, cleanup]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // === API ===
  const initiateCall = async (receiverID, conversationID, fromUserID, type = 'video') => {
    if (callStatus !== 'idle') {
      toast.error('Đang trong cuộc gọi khác');
      return null;
    }

    try {
      setIsMakingCall(true);
      setCallType(type);

      const res = await callService.initiateCall(receiverID, conversationID, type);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');
      currentCallIDRef.current = callData.callID;

      sendMessage('/app/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        fromUserID: Number(fromUserID),
        type,
        conversationID: Number(conversationID),
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type,
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
    if (!call || callStatus !== 'ringing') return;

    try {
      setCallStatus('connecting');
      setIsReceivingCall(false);

      await callService.answerCall(call.callID);
      sendMessage('/app/call.answer', {
        callID: call.callID,
        initiatorID: call.initiatorID,
        accepted: true,
      });

      await setupWebRTC({
        isCaller: false,
        targetUserId: call.initiatorID,
        callID: call.callID,
        type: call.callType,
      });
    } catch (err) {
      toast.error('Không thể nhận cuộc gọi');
      cleanup();
    }
  };

  const endCall = async () => {
    if (!call) return;

    try {
      await callService.endCall(call.callID);
    } catch (err) {
      console.error('Lỗi end call:', err);
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;

    try {
      await callService.rejectCall(call.callID);
      sendMessage('/app/call.reject', { callID: call.callID });
    } catch (err) {
      console.error('Lỗi reject call:', err);
    } finally {
      cleanup();
    }
  };

  const value = {
    call,
    callStatus,
    callType,
    isReceivingCall,
    isMakingCall,
    localStream,
    remoteStream,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    formatDuration,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};