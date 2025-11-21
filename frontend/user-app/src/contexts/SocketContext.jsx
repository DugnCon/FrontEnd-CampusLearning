import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
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
  const MAX_RETRY_ATTEMPTS = 5;
  const reconnectDelay = useRef(1000);

  // === Lấy URL SockJS
  const getSocketUrl = useCallback(() => {
    const localUrl = `https://api.campuslearning.site/ws`;
    console.log('Using SockJS URL:', localUrl);
    return localUrl;
  }, []);

  const createSockJSFactory = useCallback(() => {
    const url = getSocketUrl();
    return () => new SockJS(url);
  }, [getSocketUrl]);

  // === Gửi message nội bộ
  const sendMessageInternal = useCallback((destination, body) => {
    if (!stompClient || !isConnected) return false;
    try {
      const finalDest = destination.startsWith('/app') ? destination : `/app${destination}`;
      stompClient.publish({ destination: finalDest, body: JSON.stringify(body) });
      return true;
    } catch (e) { return false; }
  }, [stompClient, isConnected]);

  // === Process message queue
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0 || !stompClient || !isConnected) return;
    const successful = [];
    messageQueueRef.current.forEach(({ destination, body }) => {
      if (sendMessageInternal(destination, body)) successful.push({ destination, body });
    });
    messageQueueRef.current = messageQueueRef.current.filter(msg => 
      !successful.some(s => s.destination === msg.destination && s.body === msg.body)
    );
  }, [stompClient, isConnected, sendMessageInternal]);

  // === Auto-subscribe các channel quan trọng
  const autoSubscribeImportantChannels = useCallback(() => {
    const channels = [
      '/user/queue/conversations',
      '/user/queue/notifications',
      '/topic/online-users'
    ];
    channels.forEach(ch => {
      if (!subscriptionsRef.current.has(ch)) {
        console.log(`Auto-resubscribing important channel: ${ch}`);
        // Bạn có thể add callback ở đây nếu muốn
      }
    });
    // Auto subscribe call queue của user
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && user.userID) {
        const callQueue = `/user/${user.userID}/queue/call.incoming`;
        if (!subscriptionsRef.current.has(callQueue)) {
          const sub = stompClient.subscribe(callQueue, (msg) => {
            try {
              const data = JSON.parse(msg.body);
              console.log('📞 Incoming call:', data);
              // TODO: cập nhật UI call
            } catch (e) { console.error(e); }
          });
          subscriptionsRef.current.set(callQueue, sub);
          importantSubscriptionsRef.current.add(callQueue);
        }
      }
    } catch (err) { console.error(err); }
  }, [stompClient]);

  // === Cleanup socket
  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    subscriptionsRef.current.clear();
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  // === Connect socket
  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || clientRef.current?.active || isConnectingRef.current) return;
    if (connectionAttempts >= MAX_RETRY_ATTEMPTS) return;

    console.log(`Connecting... attempt ${connectionAttempts + 1}`);
    isConnectingRef.current = true;

    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        console.log('Connection timeout');
        isConnectingRef.current = false;
        setConnectionAttempts(prev => prev + 1);
      }
    }, 8000);

    const client = new Client({
      webSocketFactory: createSockJSFactory(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => { if (str.includes('ERROR') || str.includes('close')) console.log('STOMP:', str); },
      reconnectDelay: reconnectDelay.current,
      heartbeatIncoming: 3000,
      heartbeatOutgoing: 3000,
      connectionTimeout: 8000,

      onConnect: () => {
        console.log('✅ STOMP CONNECTED!');
        setIsConnected(true);
        setConnectionAttempts(0);
        reconnectDelay.current = 1000;
        setStompClient(client);
        clientRef.current = client;
        isConnectingRef.current = false;

        processMessageQueue();
        autoSubscribeImportantChannels();

        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      },

      onStompError: (frame) => {
        console.error('STOMP ERROR:', frame.headers?.message || frame.body);
        setIsConnected(false);
        isConnectingRef.current = false;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      },

      onWebSocketClose: () => { console.log('WebSocket closed'); setIsConnected(false); isConnectingRef.current = false; },
      onWebSocketError: (e) => { console.error('WebSocket error:', e); setIsConnected(false); isConnectingRef.current = false; }
    });

    client.activate();
    clientRef.current = client;
  }, [createSockJSFactory, connectionAttempts, isConnected, processMessageQueue, autoSubscribeImportantChannels]);

  // === Auto connect
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isConnected && !isConnectingRef.current) connect();
    else if (!token) cleanup();
  }, [connect, isConnected, cleanup]);

  // === Auto reconnect
  useEffect(() => {
    if (!isConnected && localStorage.getItem('token') &&
        connectionAttempts < MAX_RETRY_ATTEMPTS &&
        !isConnectingRef.current) {
      const timer = setTimeout(connect, reconnectDelay.current);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectionAttempts, connect]);

  // === Subscribe
  const subscribe = useCallback((destination, callback) => {
    if (!stompClient || !isConnected) {
      if (destination.includes('/user/queue/') || destination.includes('/topic/')) {
        importantSubscriptionsRef.current.add(destination);
      }
      return null;
    }
    if (subscriptionsRef.current.has(destination)) subscriptionsRef.current.get(destination).unsubscribe();
    const sub = stompClient.subscribe(destination, (msg) => {
      try {
        const data = JSON.parse(msg.body);
        callback(data);
      } catch (e) { console.error(e); }
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
    if (sendMessageInternal(destination, body)) return true;
    messageQueueRef.current.push({ destination, body, timestamp: Date.now() });
    if (messageQueueRef.current.length > 100) messageQueueRef.current = messageQueueRef.current.slice(-50);
    return false;
  }, [sendMessageInternal]);

  const manualReconnect = useCallback(() => { cleanup(); setConnectionAttempts(0); reconnectDelay.current = 1000; setTimeout(connect, 100); }, [cleanup, connect]);
  const testConnection = useCallback(() => { const sock = new SockJS(getSocketUrl()); sock.onopen = () => sock.close(); sock.onerror = e => console.error(e); }, [getSocketUrl]);
  const getQueueSize = useCallback(() => messageQueueRef.current.length, []);
  const flushQueue = useCallback(() => processMessageQueue(), [processMessageQueue]);
  const getConnectionStats = useCallback(() => ({
    isConnected,
    isConnecting: isConnectingRef.current,
    connectionAttempts,
    queueSize: messageQueueRef.current.length,
    subscriptions: subscriptionsRef.current.size,
    importantSubscriptions: importantSubscriptionsRef.current.size
  }), [isConnected, connectionAttempts]);

  const value = {
    stompClient, isConnected, onlineUsers, setOnlineUsers,
    subscribe, unsubscribe, sendMessage,
    connectionAttempts, maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    manualReconnect, testConnection, getConnectionStatus: () => isConnected ? 'connected' : 'disconnected',
    getQueueSize, flushQueue, getConnectionStats
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
