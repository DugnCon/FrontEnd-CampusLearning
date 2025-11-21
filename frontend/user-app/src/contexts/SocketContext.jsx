import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [stompClient, setStompClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const subscriptionsRef = useRef(new Map());
  const clientRef = useRef(null);
  const messageQueueRef = useRef([]);
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef(null);
  const importantSubscriptionsRef = useRef(new Set());
  const callEventsRef = useRef(new Map());

  const MAX_RETRY_ATTEMPTS = 5;
  const reconnectDelay = useRef(1000);

  const getSocketUrl = useCallback(() => {
    return `https://api.campuslearning.site/ws`;
  }, []);

  const createSockJSFactory = useCallback(() => {
    const url = getSocketUrl();
    return () => new SockJS(url);
  }, [getSocketUrl]);

  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0 || !stompClient || !isConnected) return;

    const successfulMessages = [];
    messageQueueRef.current.forEach(({ destination, body }) => {
      if (sendMessageInternal(destination, body)) {
        successfulMessages.push({ destination, body });
      }
    });

    messageQueueRef.current = messageQueueRef.current.filter(msg => 
      !successfulMessages.some(success => 
        success.destination === msg.destination && 
        success.body === msg.body
      )
    );
  }, [stompClient, isConnected]);

  const sendMessageInternal = useCallback((destination, body) => {
    if (!stompClient || !isConnected) return false;
    try {
      const finalDestination = destination.startsWith('/app') ? destination : `/app${destination}`;
      stompClient.publish({
        destination: finalDestination,
        body: JSON.stringify(body)
      });
      return true;
    } catch (e) {
      return false;
    }
  }, [stompClient, isConnected]);

  const autoSubscribeCallEvents = useCallback(() => {
    const userID = user?.userID;
    if (!userID) return;

    const callChannels = [
      `/user/${userID}/queue/call.incoming`,
      `/user/${userID}/queue/call.answered`,
      `/user/${userID}/queue/call.rejected`,
      `/user/${userID}/queue/call.ended`,
      `/user/${userID}/queue/call.signal`,
      `/user/${userID}/queue/call.error`
    ];

    callChannels.forEach(channel => {
      if (!subscriptionsRef.current.has(channel)) {
        subscribe(channel, (data) => {
          if (callEventsRef.current.has(channel)) {
            callEventsRef.current.get(channel).forEach(callback => callback(data));
          }
        });
      }
    });
  }, [user]);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    subscriptionsRef.current.forEach((sub, dest) => {
      try {
        sub.unsubscribe();
      } catch (e) {}
    });
    subscriptionsRef.current.clear();
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (clientRef.current?.active || isConnectingRef.current) return;
    if (connectionAttempts >= MAX_RETRY_ATTEMPTS) return;

    isConnectingRef.current = true;
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        isConnectingRef.current = false;
        setConnectionAttempts(prev => prev + 1);
      }
    }, 8000);

    const client = new Client({
      webSocketFactory: createSockJSFactory(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => {
        if (str.includes('ERROR') || str.includes('close') || str.includes('Whoops')) {
          console.log('STOMP:', str);
        }
      },
      reconnectDelay: reconnectDelay.current,
      heartbeatIncoming: 3000,
      heartbeatOutgoing: 3000,
      connectionTimeout: 8000,

      onConnect: () => {
        setIsConnected(true);
        setConnectionAttempts(0);
        reconnectDelay.current = 1000;
        setStompClient(client);
        clientRef.current = client;
        isConnectingRef.current = false;
        autoSubscribeCallEvents();
        processMessageQueue();
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      },

      onStompError: (frame) => {
        setIsConnected(false);
        isConnectingRef.current = false;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      },

      onWebSocketClose: () => {
        setIsConnected(false);
        isConnectingRef.current = false;
      },

      onWebSocketError: (e) => {
        setIsConnected(false);
        isConnectingRef.current = false;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      }
    });

    client.activate();
    clientRef.current = client;
  }, [createSockJSFactory, connectionAttempts, isConnected, processMessageQueue, autoSubscribeCallEvents]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isConnected && !isConnectingRef.current) {
      connect();
    } else if (!token) {
      cleanup();
    }
  }, [connect, isConnected, cleanup]);

  useEffect(() => {
    if (!isConnected && localStorage.getItem('token') && 
        connectionAttempts < MAX_RETRY_ATTEMPTS && 
        !isConnectingRef.current) {
      const timer = setTimeout(connect, reconnectDelay.current);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectionAttempts, connect]);

  const subscribe = useCallback((destination, callback) => {
    if (!stompClient || !isConnected) {
      if (destination.includes('/user/queue/') || destination.includes('/topic/')) {
        importantSubscriptionsRef.current.add(destination);
      }
      return null;
    }

    if (subscriptionsRef.current.has(destination)) {
      subscriptionsRef.current.get(destination).unsubscribe();
    }

    const sub = stompClient.subscribe(destination, (msg) => {
      try {
        const data = JSON.parse(msg.body);
        callback(data);
      } catch (e) {
        console.error('Parse error:', e);
      }
    });

    subscriptionsRef.current.set(destination, sub);
    if (destination.includes('/user/queue/') || destination.includes('/topic/')) {
      importantSubscriptionsRef.current.add(destination);
    }
    
    return sub;
  }, [stompClient, isConnected]);

  const unsubscribe = useCallback((destination) => {
    const sub = subscriptionsRef.current.get(destination);
    if (sub) {
      sub.unsubscribe();
      subscriptionsRef.current.delete(destination);
      importantSubscriptionsRef.current.delete(destination);
    }
  }, []);

  const sendMessage = useCallback((destination, body) => {
    if (sendMessageInternal(destination, body)) {
      return true;
    }
    messageQueueRef.current.push({ destination, body, timestamp: Date.now() });
    if (messageQueueRef.current.length > 100) {
      messageQueueRef.current = messageQueueRef.current.slice(-50);
    }
    return false;
  }, [sendMessageInternal]);

  const onCallEvent = useCallback((eventType, callback) => {
    const userID = user?.userID;
    if (!userID) return () => {};
    
    const channel = `/user/${userID}/queue/call.${eventType}`;
    if (!callEventsRef.current.has(channel)) {
      callEventsRef.current.set(channel, new Set());
    }
    callEventsRef.current.get(channel).add(callback);
    
    return () => {
      if (callEventsRef.current.has(channel)) {
        callEventsRef.current.get(channel).delete(callback);
      }
    };
  }, [user]);

  const manualReconnect = useCallback(() => {
    cleanup();
    setConnectionAttempts(0);
    reconnectDelay.current = 1000;
    setTimeout(connect, 100);
  }, [cleanup, connect]);

  const value = {
    stompClient,
    isConnected,
    onlineUsers,
    setOnlineUsers,
    subscribe,
    unsubscribe,
    sendMessage,
    connectionAttempts,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    manualReconnect,
    onCallEvent,
    getConnectionStatus: () => isConnected ? 'connected' : 'disconnected',
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};