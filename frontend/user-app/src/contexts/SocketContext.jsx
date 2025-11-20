
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Tạo context
const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [stompClient, setStompClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const subscriptionsRef = useRef(new Map());
  const clientRef = useRef(null);

  // 🚀 THÊM: Message queue và connection tracking
  const messageQueueRef = useRef([]);
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef(null);
  const importantSubscriptionsRef = useRef(new Set());

  const MAX_RETRY_ATTEMPTS = 5;
  const reconnectDelay = useRef(1000);

  // 🔥 XÁC ĐỊNH URL DỰA TRÊN MÔI TRƯỜNG
  const getSocketUrl = useCallback(() => {
    const LOCAL_URL = import.meta.env.VITE_SOCKET_URL;
    const localUrl = `https://api.campuslearning.site/ws`;
    //const localUrl = `http://localhost:8080/ws`;
    console.log('Using Local HTTP SockJS URL:', localUrl);
    return localUrl;
  }, []);

  // 🔥 TẠO SOCKJS FACTORY – HOẠT ĐỘNG VỚI CẢ HTTPS & HTTP
  const createSockJSFactory = useCallback(() => {
    const url = getSocketUrl();
    return () => {
      console.log('Creating SockJS connection to:', url);
      return new SockJS(url);
    };
  }, [getSocketUrl]);

  // 🚀 THÊM: Process message queue khi kết nối
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0 || !stompClient || !isConnected) return;

    console.log(`📤 Processing ${messageQueueRef.current.length} queued messages...`);
    
    const successfulMessages = [];
    
    messageQueueRef.current.forEach(({ destination, body, timestamp }) => {
      if (sendMessageInternal(destination, body)) {
        successfulMessages.push({ destination, body, timestamp });
      }
    });

    // Chỉ giữ lại những message gửi thất bại
    messageQueueRef.current = messageQueueRef.current.filter(msg => 
      !successfulMessages.some(success => 
        success.destination === msg.destination && 
        success.body === msg.body
      )
    );

    console.log(`✅ Sent ${successfulMessages.length} queued messages`);
  }, [stompClient, isConnected]);

  // 🚀 THÊM: Send message internal (không log)
  const sendMessageInternal = useCallback((destination, body) => {
    if (!stompClient || !isConnected) return false;

    try {
      const finalDestination = destination.startsWith('/app') 
      ? destination 
      : `/app${destination}`;
      console.log("Gửi đích thực tế:", finalDestination);
      stompClient.publish({
        destination: finalDestination,
        body: JSON.stringify(body)
      });
      return true;
    } catch (e) {
      return false;
    }
  }, [stompClient, isConnected]);

  // 🚀 THÊM: Auto-subscribe các channel quan trọng
  const autoSubscribeImportantChannels = useCallback(() => {
    const importantChannels = [
      '/user/queue/conversations',
      '/user/queue/notifications',
      '/topic/online-users'
    ];

    importantSubscriptionsRef.current.forEach(channel => {
      if (!subscriptionsRef.current.has(channel)) {
        console.log(`🔄 Auto-resubscribing to important channel: ${channel}`);
        // Component sẽ tự resubscribe khi remount
      }
    });
  }, []);

  // 🔥 CLEANUP KHI UNMOUNT
  const cleanup = useCallback(() => {
    console.log('Cleaning up socket...');
    
    // 🚀 THÊM: Clear timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    subscriptionsRef.current.forEach((sub, dest) => {
      try {
        sub.unsubscribe();
        console.log(`Unsubscribed from ${dest}`);
      } catch (e) { /* ignore */ }
    });
    subscriptionsRef.current.clear();

    if (clientRef.current) {
      clientRef.current.deactivate();
      console.log('STOMP client deactivated');
      clientRef.current = null;
    }
    
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token, skip socket connect');
      return;
    }

    if (clientRef.current?.active || isConnectingRef.current) {
      console.log('Already connected or connecting');
      return;
    }

    if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
      console.warn('Max retry attempts reached');
      return;
    }

    console.log(`🚀 FAST Connecting... (attempt ${connectionAttempts + 1})`);
    isConnectingRef.current = true;

    // 🚀 THÊM: Connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        console.log('⏰ Connection timeout');
        isConnectingRef.current = false;
        setConnectionAttempts(prev => prev + 1);
      }
    }, 8000); // Reduced from 10s to 8s

    const client = new Client({
      webSocketFactory: createSockJSFactory(),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      debug: (str) => {
        if (str.includes('ERROR') || str.includes('close') || str.includes('Whoops')) {
          console.log('STOMP:', str);
        }
      },
      reconnectDelay: reconnectDelay.current,
      heartbeatIncoming: 3000, // 🚀 Reduced from 4000 to 3000
      heartbeatOutgoing: 3000, // 🚀 Reduced from 4000 to 3000
      connectionTimeout: 8000, // 🚀 Reduced from 10000 to 8000

      onConnect: () => {
        console.log('✅ STOMP CONNECTED SUCCESSFULLY!');
        setIsConnected(true);
        setConnectionAttempts(0);
        reconnectDelay.current = 1000;
        setStompClient(client);
        clientRef.current = client;
        isConnectingRef.current = false;
        
        // 🚀 THÊM: Process queue và auto-subscribe
        processMessageQueue();
        autoSubscribeImportantChannels();
        
        // Clear timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      },

      onStompError: (frame) => {
        console.error('STOMP ERROR:', frame.headers?.message || frame.body);
        setIsConnected(false);
        isConnectingRef.current = false;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
        
        // Clear timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      },

      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        isConnectingRef.current = false;
      },

      onWebSocketError: (e) => {
        console.error('WebSocket error:', e);
        setIsConnected(false);
        isConnectingRef.current = false;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
        
        // Clear timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      }
    });

    client.activate();
    clientRef.current = client;
  }, [createSockJSFactory, connectionAttempts, isConnected, processMessageQueue, autoSubscribeImportantChannels]);

  // 🔥 AUTO CONNECT KHI CÓ TOKEN - TỐI ƯU
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isConnected && !isConnectingRef.current) {
      // 🚀 THÊM: Kết nối ngay lập tức thay vì chờ 500ms
      connect();
    } else if (!token) {
      cleanup();
    }
  }, [connect, isConnected, cleanup]);

  // 🔥 AUTO RECONNECT - TỐI ƯU
  useEffect(() => {
    if (!isConnected && localStorage.getItem('token') && 
        connectionAttempts < MAX_RETRY_ATTEMPTS && 
        !isConnectingRef.current) {
      const timer = setTimeout(connect, reconnectDelay.current);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectionAttempts, connect]);

  // 🔥 SUBSCRIBE - TỐI ƯU
  const subscribe = useCallback((destination, callback) => {
    if (!stompClient || !isConnected) {
      console.warn('Not connected, cannot subscribe:', destination);
      
      // 🚀 THÊM: Đánh dấu channel quan trọng để auto-resubscribe
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
        console.log(`Received [${destination}]:`, data);
        callback(data);
      } catch (e) {
        console.error('Parse error:', e);
      }
    });

    subscriptionsRef.current.set(destination, sub);
    
    // 🚀 THÊM: Đánh dấu channel quan trọng
    if (destination.includes('/user/queue/') || destination.includes('/topic/')) {
      importantSubscriptionsRef.current.add(destination);
    }
    
    console.log(`Subscribed to ${destination}`);
    return sub;
  }, [stompClient, isConnected]);

  // 🔥 UNSUBSCRIBE - GIỮ NGUYÊN
  const unsubscribe = useCallback((destination) => {
    const sub = subscriptionsRef.current.get(destination);
    if (sub) {
      sub.unsubscribe();
      subscriptionsRef.current.delete(destination);
      importantSubscriptionsRef.current.delete(destination);
      console.log(`Unsubscribed from ${destination}`);
    }
  }, []);

  // 🔥 SEND - TỐI ƯU VỚI QUEUE
  const sendMessage = useCallback((destination, body) => {
    // 🚀 THÊM: Thử gửi ngay lập tức
    if (sendMessageInternal(destination, body)) {
      console.log(`Sent to /app${destination}:`, body);
      return true;
    }

    // 🚀 THÊM: Nếu không thành công, add vào queue
    console.log(`💾 Queuing message to /app${destination}:`, body);
    messageQueueRef.current.push({
      destination,
      body,
      timestamp: Date.now()
    });

    // 🚀 THÊM: Giới hạn queue để tránh memory leak
    if (messageQueueRef.current.length > 100) {
      messageQueueRef.current = messageQueueRef.current.slice(-50);
    }

    return false;
  }, [sendMessageInternal]);

  // 🔥 MANUAL RECONNECT - GIỮ NGUYÊN
  const manualReconnect = useCallback(() => {
    console.log('Manual reconnect...');
    cleanup();
    setConnectionAttempts(0);
    reconnectDelay.current = 1000;
    setTimeout(connect, 100); // 🚀 Reduced from 500 to 100
  }, [cleanup, connect]);

  // 🔥 TEST CONNECTION - GIỮ NGUYÊN
  const testConnection = useCallback(() => {
    const url = getSocketUrl();
    console.log('Testing direct SockJS to:', url);
    const sock = new SockJS(url);
    sock.onopen = () => {
      console.log('Direct SockJS test: OPEN');
      sock.close();
    };
    sock.onerror = (e) => console.error('Direct SockJS test: ERROR', e);
  }, [getSocketUrl]);

  // 🚀 THÊM: Các utility functions mới
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
    // 🎯 GIỮ NGUYÊN TẤT CẢ PROPERTIES HIỆN CÓ
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
    testConnection,
    getConnectionStatus: () => isConnected ? 'connected' : 'disconnected',
    
    // 🚀 THÊM: Các functions mới để tối ưu
    getQueueSize,
    flushQueue,
    getConnectionStats
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