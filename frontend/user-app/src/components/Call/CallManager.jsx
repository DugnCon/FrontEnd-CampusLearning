import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import CallInterface from './CallInterface';
import IncomingCall from './IncomingCall';
import { callApi } from '../../services/callApi';

const CallManager = () => {
  const socket = useSocket();
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  // Get current user ID
  const getCurrentUserId = () => {
    const userId = localStorage.getItem('userId');
    console.log('👤 Current User ID from localStorage:', userId);
    return userId;
  };

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) {
      console.log('❌ CALL MANAGER - No socket connection');
      return;
    }

    console.log('✅ CALL MANAGER - Setting up call listeners...');
    console.log('🔌 Socket connected:', socket.connected);
    console.log('🔌 Socket ID:', socket.id);

    // Listen for ALL messages for debugging
    socket.onAny((event, data) => {
      console.log('📨 CALL MANAGER - Received ANY message:', event, data);
    });

    // Specific call event handlers
    socket.on('CALL_INITIATED', (data) => {
      console.log('📞 CALL MANAGER - INCOMING CALL RECEIVED:', data);
      setIncomingCall(data.data);
    });

    socket.on('CALL_ANSWERED', (data) => {
      console.log('✅ CALL MANAGER - CALL ANSWERED:', data);
      setActiveCall(data.data);
      setIncomingCall(null);
    });

    socket.on('CALL_ENDED', (data) => {
      console.log('❌ CALL MANAGER - CALL ENDED:', data);
      setActiveCall(null);
      setIncomingCall(null);
    });

    socket.on('CALL_REJECTED', (data) => {
      console.log('🚫 CALL MANAGER - CALL REJECTED:', data);
      setIncomingCall(null);
    });

    // Subscribe to user-specific queues
    const userId = getCurrentUserId();
    if (userId) {
      socket.emit('subscribe', `/user/${userId}/queue/call-invite`);
      socket.emit('subscribe', `/user/${userId}/queue/call-events`);
      console.log('📡 Subscribed to user queues for user:', userId);
    }

    return () => {
      socket.offAny();
      socket.off('CALL_INITIATED');
      socket.off('CALL_ANSWERED');
      socket.off('CALL_ENDED');
      socket.off('CALL_REJECTED');
    };
  }, [socket]);

  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    
    try {
      console.log('📞 CALL MANAGER - Answering call:', incomingCall.callId);
      await callApi.answerCall({ callId: incomingCall.callId });
      setActiveCall(incomingCall);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      console.log('🚫 CALL MANAGER - Rejecting call:', incomingCall.callId);
      await callApi.rejectCall({ callId: incomingCall.callId });
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const handleEndCall = () => {
    console.log('❌ CALL MANAGER - Ending call');
    setActiveCall(null);
    setIncomingCall(null);
  };

  return (
    <>
      {/* Active Call */}
      {activeCall && (
        <CallInterface 
          call={activeCall}
          onEndCall={handleEndCall}
          isVideoCall={activeCall.type === 'video'}
        />
      )}
      
      {/* Incoming Call */}
      {incomingCall && (
        <IncomingCall 
          callData={incomingCall}
          onAnswer={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}
    </>
  );
};

export default CallManager;