// contexts/SocketContext.js
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

  const MAX_RETRY_ATTEMPTS = 5;
  const reconnectDelay = useRef(1000);

  // 🔥 XÁC ĐỊNH URL DỰA TRÊN MÔI TRƯỜNG
  const getSocketUrl = useCallback(() => {
    const isNgrok = window.location.hostname.includes('ngrok');
    const origin = window.location.origin;

    if (isNgrok) {
      const url = `${origin}/ws`;
      console.log('Using Ngrok HTTPS SockJS URL:', url);
      return url;
    } else {
      const LOCAL_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const localUrl = `${LOCAL_URL}/ws`;
      console.log('Using Local HTTP SockJS URL:', localUrl);
      return localUrl;
    }
  }, []);

  // 🔥 TẠO SOCKJS FACTORY – HOẠT ĐỘNG VỚI CẢ HTTPS & HTTP
  const createSockJSFactory = useCallback(() => {
    const url = getSocketUrl();
    return () => {
      console.log('Creating SockJS connection to:', url);
      return new SockJS(url);
    };
  }, [getSocketUrl]);

  // 🔥 CLEANUP KHI UNMOUNT
  const cleanup = useCallback(() => {
    console.log('Cleaning up socket...');
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
    setIsConnected(false);
  }, []);

  // 🔥 CONNECT FUNCTION
  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token, skip socket connect');
      return;
    }

    if (clientRef.current?.active) {
      console.log('Already connected');
      return;
    }

    if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
      console.warn('Max retry attempts reached');
      return;
    }

    console.log(`Connecting... (attempt ${connectionAttempts + 1})`);

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
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectionTimeout: 10000,

      onConnect: () => {
        console.log('STOMP CONNECTED SUCCESSFULLY!');
        setIsConnected(true);
        setConnectionAttempts(0);
        reconnectDelay.current = 1000;
        setStompClient(client);
        clientRef.current = client;
      },

      onStompError: (frame) => {
        console.error('STOMP ERROR:', frame.headers?.message || frame.body);
        setIsConnected(false);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
      },

      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setIsConnected(false);
      },

      onWebSocketError: (e) => {
        console.error('WebSocket error:', e);
        setIsConnected(false);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        setConnectionAttempts(prev => prev + 1);
      }
    });

    client.activate();
    clientRef.current = client;
  }, [createSockJSFactory, connectionAttempts]);

  // 🔥 AUTO CONNECT KHI CÓ TOKEN
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isConnected) {
      const timer = setTimeout(connect, 500);
      return () => clearTimeout(timer);
    } else if (!token) {
      cleanup();
    }
  }, [connect, isConnected, cleanup]);

  // 🔥 AUTO RECONNECT
  useEffect(() => {
    if (!isConnected && localStorage.getItem('token') && connectionAttempts < MAX_RETRY_ATTEMPTS) {
      const timer = setTimeout(connect, reconnectDelay.current);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectionAttempts, connect]);

  // 🔥 SUBSCRIBE
  const subscribe = useCallback((destination, callback) => {
    if (!stompClient || !isConnected) {
      console.warn('Not connected, cannot subscribe:', destination);
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
    console.log(`Subscribed to ${destination}`);
    return sub;
  }, [stompClient, isConnected]);

  // 🔥 UNSUBSCRIBE
  const unsubscribe = useCallback((destination) => {
    const sub = subscriptionsRef.current.get(destination);
    if (sub) {
      sub.unsubscribe();
      subscriptionsRef.current.delete(destination);
      console.log(`Unsubscribed from ${destination}`);
    }
  }, []);

  // 🔥 SEND
  const sendMessage = useCallback((destination, body) => {
    if (!stompClient || !isConnected) return false;

    try {
      stompClient.publish({
        destination: `/app${destination}`,
        body: JSON.stringify(body)
      });
      console.log(`Sent to /app${destination}:`, body);
      return true;
    } catch (e) {
      console.error('Send error:', e);
      return false;
    }
  }, [stompClient, isConnected]);

  // 🔥 MANUAL RECONNECT
  const manualReconnect = useCallback(() => {
    console.log('Manual reconnect...');
    cleanup();
    setConnectionAttempts(0);
    reconnectDelay.current = 1000;
    setTimeout(connect, 500);
  }, [cleanup, connect]);

  // 🔥 TEST CONNECTION
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
    testConnection,
    getConnectionStatus: () => isConnected ? 'connected' : 'disconnected'
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