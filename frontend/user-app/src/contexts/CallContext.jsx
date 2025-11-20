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

  const getCurrentUserID = () => {
    // ✅ LUÔN DÙNG fromUserIDRef - KHÔNG DÙNG user context nữa
    return fromUserIDRef.current;
  };

  const cleanup = () => {
    console.log('🧹 CLEANUP CALL');
    
    stopTimer();
    
    // Cleanup WebRTC resources using utility function
    webrtcEndCall(peerConnectionRef.current, localStream);
    
    // Reset state
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
    
    if (!isConnected || !currentCallIDRef.current || !targetUserIDRef.current || !currentUserID) {
      console.warn('📡 Không thể gửi signal – thiếu thông tin', {
        connected: isConnected,
        callID: currentCallIDRef.current,
        targetUser: targetUserIDRef.current,
        currentUser: currentUserID
      });
      return;
    }

    const message = {
      toUserID: targetUserIDRef.current.toString(),
      fromUserID: currentUserID.toString(), 
      callID: currentCallIDRef.current,
      signal: { type: signal.type }
    };

    if (signal.sdp) message.signal.sdp = signal.sdp;
    if (signal.candidate) message.signal.candidate = signal.candidate;

    console.log('📤 Sending signal:', signal.type, {
      from: currentUserID,
      to: targetUserIDRef.current,
      callID: currentCallIDRef.current
    });
    
    sendMessage('/app/call.signal', message);
  };

  const setupWebRTC = async ({ isCaller, targetUserId, callID, type }) => {
    // Cleanup existing connection
    if (peerConnectionRef.current) {
      webrtcEndCall(peerConnectionRef.current, localStream);
    }

    try {
      console.log('🎬 Setting up WebRTC:', { isCaller, type });
      
      // Get local stream using utility
      const stream = await getLocalStream(true, type === 'video');
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Store call metadata
      currentCallIDRef.current = callID;
      targetUserIDRef.current = targetUserId;
      // fromUserIDRef đã được set từ initiateCall hoặc incoming call

      // Create peer connection using utility
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add tracks using utility
      addTracksToConnection(pc, stream);

      // Setup event handlers
      pc.ontrack = (e) => {
        console.log('📹 Remote track received');
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('❄️ ICE candidate generated');
          sendSignal({ type: 'candidate', candidate: e.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('🔌 ICE connection state:', pc.iceConnectionState);
        switch (pc.iceConnectionState) {
          case 'connected':
            console.log('✅ ICE connected');
            break;
          case 'disconnected':
            toast.error('📶 Kết nối yếu');
            break;
          case 'failed':
            toast.error('❌ Kết nối thất bại');
            cleanup();
            break;
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('🎉 Peer connection established');
        } else if (pc.connectionState === 'failed') {
          toast.error('🔴 Kết nối bị mất');
          cleanup();
        }
      };

      // Create offer if caller
      if (isCaller) {
        console.log('🤙 Creating offer as caller');
        const offer = await createOffer(pc);
        sendSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    } catch (err) {
      console.error('🚨 WebRTC setup failed:', err);
      toast.error(err.message.includes('NotAllowedError') 
        ? '❌ Quyền truy cập camera/micro bị từ chối'
        : '❌ Không thể khởi tạo cuộc gọi'
      );
      cleanup();
      throw err;
    }
  };

  // WebRTC Signal Handler
  const handleWebRTCSignal = async (data) => {
    const { signal, callID } = data;
    
    if (callID !== currentCallIDRef.current) {
      console.warn('📞 Signal for different call ID, ignoring');
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('🚨 No peer connection for signal');
      return;
    }

    try {
      console.log('📨 Processing signal:', signal.type);
      
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
          toast.success('✅ Kết nối thành công');
          break;
          
        case 'candidate':
          await addIceCandidate(pc, signal.candidate);
          break;
          
        default:
          console.warn('❓ Unknown signal type:', signal.type);
      }
    } catch (err) {
      console.error('🚨 Signal processing error:', err);
      toast.error('❌ Lỗi xử lý tín hiệu');
    }
  };

  useEffect(() => {
    if (!isConnected || !subscribe) return;

    console.log('🔔 Subscribing to call events');
    
    const unsubs = [
      // INCOMING CALL
      subscribe('/user/queue/call.incoming', (data) => {
        console.log('📞 Incoming call:', data);
        
        if (callStatus !== 'idle') {
          console.log('🚫 Busy, auto rejecting');
          sendMessage('/app/call.reject', { callID: data.callID });
          return;
        }
        
        setCall(data);
        setCallType(data.callType || 'video');
        setCallStatus('ringing');
        setIsReceivingCall(true);
        currentCallIDRef.current = data.callID;
        targetUserIDRef.current = data.initiatorID;
        
        // ✅ SET fromUserIDRef TỪ CALL DATA (người nhận cuộc gọi)
        fromUserIDRef.current = data.receiverID || user?.id;

        toast(`📞 Cuộc gọi ${data.callType} từ ${data.initiatorName}`, { 
          duration: 15000,
          icon: '📞'
        });
      }),

      // CALL ANSWERED
      subscribe('/user/queue/call.answered', (data) => {
        console.log('✅ Call answered:', data);
        setCallStatus('connecting');
        setIsReceivingCall(false);
      }),

      // CALL REJECTED
      subscribe('/user/queue/call.rejected', (data) => {
        console.log('❌ Call rejected:', data);
        if (isMakingCall || isReceivingCall) {
          toast.error('⏹️ Cuộc gọi bị từ chối');
          cleanup();
        }
      }),

      // CALL ENDED
      subscribe('/user/queue/call.ended', (data) => {
        console.log('🔚 Call ended:', data);
        if (callStatus === 'ongoing' || callStatus === 'connecting') {
          toast.success(`⏱️ Cuộc gọi kết thúc • ${formatDuration(callDuration)}`);
          cleanup();
        }
      }),

      // WEBRTC SIGNALS
      subscribe('/user/queue/call.signal', handleWebRTCSignal),

      // CALL ERRORS
      subscribe('/user/queue/call.error', (data) => {
        console.error('🚨 Call error:', data);
        toast.error(data.message || '❌ Lỗi cuộc gọi');
        cleanup();
      })
    ];

    return () => {
      console.log('🔕 Unsubscribing from call events');
      unsubs.forEach(u => {
        if (u && typeof u === 'function') {
          u();
        }
      });
    };
  }, [isConnected, subscribe, callStatus, isMakingCall, isReceivingCall, callDuration, sendMessage, user]);

  // API METHODS
  const initiateCall = async (receiverID, conversationID, type = 'video') => {
    if (callStatus !== 'idle') {
      toast.error('📞 Đang có cuộc gọi khác');
      return null;
    }

    if (isMakingCall) {
      toast.error('⏳ Đang xử lý cuộc gọi...');
      return null;
    }

    try {
      console.log('🤙 Initiating call to:', receiverID);
      
      const validatedType = type === 'audio' ? 'audio' : 'video';
      
      setIsMakingCall(true);
      setCallType(validatedType);

      const res = await callService.initiateCall(receiverID, conversationID, validatedType);
      const callData = res.call || res;

      setCall(callData);
      setCallStatus('ringing');
      currentCallIDRef.current = callData.callID;
      targetUserIDRef.current = receiverID;
      
      // ✅ SET fromUserIDRef TỪ CALL DATA (người gọi)
      fromUserIDRef.current = callData.initiatorID;

      sendMessage('/app/call.initiate', {
        receiverID: Number(receiverID),
        callID: Number(callData.callID),
        type: validatedType,
        conversationID: Number(conversationID)
      });

      await setupWebRTC({
        isCaller: true,
        targetUserId: receiverID,
        callID: callData.callID,
        type: validatedType 
      });

      return callData;
    } catch (err) {
      console.error('🚨 Initiate call error:', err);
      toast.error(err.response?.data?.message || '❌ Không thể gọi');
      cleanup();
      return null;
    }
  };

  const answerCall = async () => {
    if (!call || callStatus !== 'ringing') {
      toast.error('❌ Không thể nghe máy');
      return;
    }

    console.log('📞 Answering call:', call.callID);
    setCallStatus('connecting');
    setIsReceivingCall(false);

    try {
      // Send answer signal first
      sendMessage('/app/call.answer', {
        callID: call.callID,
        initiatorID: call.initiatorID,
        accepted: true
      });

      await callService.answerCall(call.callID);
      
      // Setup WebRTC for callee
      if (callStatus === 'connecting') {
        await setupWebRTC({
          isCaller: false,
          targetUserId: call.initiatorID,
          callID: call.callID,
          type: call.callType
        });
      }
    } catch (err) {
      console.error('🚨 Answer call error:', err);
      toast.error('❌ Lỗi khi nghe máy');
      cleanup();
    }
  };

  const endCall = async () => {
    if (!call) return;
    
    console.log('📞 Ending call:', call.callID);
    try {
      await callService.endCall(call.callID);
      sendMessage('/app/call.end', { callID: call.callID });
    } catch (err) {
      console.error('🚨 End call error:', err);
    } finally {
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (!call) return;
    
    console.log('📞 Rejecting call:', call.callID);
    try {
      await callService.rejectCall(call.callID);
      sendMessage('/app/call.reject', { callID: call.callID });
    } catch (err) {
      console.error('🚨 Reject call error:', err);
    } finally {
      cleanup();
    }
  };

  const value = {
    // State
    call, 
    callStatus, 
    callType,
    isReceivingCall, 
    isMakingCall,
    localStream, 
    remoteStream, 
    callDuration,
    
    // Refs
    localVideoRef, 
    remoteVideoRef,
    
    // Methods
    initiateCall, 
    answerCall, 
    endCall, 
    rejectCall,
    formatDuration,
    
    // Debug info
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