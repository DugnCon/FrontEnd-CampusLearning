// contexts/SocketContext.js
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_URL } from '../config';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [stompClient, setStompClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const subscriptionsRef = useRef(new Map()); // Lưu trữ các subscription

  const MAX_RETRY_ATTEMPTS = 3;

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!storedUser || !token) return;

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Khởi tạo STOMP client
      const client = new Client({
        webSocketFactory: () => new SockJS(`${API_URL}/ws`),
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        debug: (str) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('STOMP Debug:', str);
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: (frame) => {
          console.log('✅ STOMP Connected successfully');
          setIsConnected(true);
          setConnectionAttempts(0);
          setStompClient(client);
        },
        onStompError: (frame) => {
          console.error('❌ STOMP Error:', frame.headers?.message || frame.body);
          setIsConnected(false);
          
          if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
            setConnectionAttempts(prev => prev + 1);
          }
        },
        onDisconnect: () => {
          console.log('🔴 STOMP Disconnected');
          setIsConnected(false);
        },
        onWebSocketClose: (event) => {
          console.log('🔴 WebSocket Closed:', event);
          setIsConnected(false);
        },
        onWebSocketError: (event) => {
          console.error('❌ WebSocket Error:', event);
          setIsConnected(false);
        }
      });

      // Kích hoạt kết nối
      client.activate();

      // Cleanup khi unmount
      return () => {
        if (client) {
          // Hủy tất cả subscriptions
          subscriptionsRef.current.forEach((subscription, destination) => {
            try {
              subscription.unsubscribe();
              console.log(`Unsubscribed from ${destination}`);
            } catch (error) {
              console.warn(`Error unsubscribing from ${destination}:`, error);
            }
          });
          subscriptionsRef.current.clear();
          
          // Ngắt kết nối
          client.deactivate();
          console.log('STOMP client deactivated');
        }
      };
    } catch (error) {
      console.error('Error setting up STOMP:', error);
    }
  }, []);

  // Tự động reconnect khi token thay đổi
  useEffect(() => {
    if (!stompClient) return;
    if (isConnected || connectionAttempts >= MAX_RETRY_ATTEMPTS) return;

    const token = localStorage.getItem('token');
    if (token) {
      try {
        // STOMP sẽ tự động reconnect với connectHeaders mới
        console.log('Attempting to reconnect STOMP...');
      } catch (err) {
        console.warn('Reconnect failed:', err.message);
      }
    }
  }, [stompClient, isConnected, connectionAttempts]);

  // Subscribe to a topic
  const subscribe = (destination, callback) => {
    if (!stompClient || !isConnected) {
      console.warn('STOMP not connected, cannot subscribe to:', destination);
      return null;
    }
    
    try {
      // Kiểm tra nếu đã subscribe rồi thì hủy cái cũ
      if (subscriptionsRef.current.has(destination)) {
        subscriptionsRef.current.get(destination).unsubscribe();
      }

      const subscription = stompClient.subscribe(destination, (message) => {
        try {
          const data = JSON.parse(message.body);
          if (process.env.NODE_ENV === 'development') {
            console.log(`📨 Received from ${destination}:`, data);
          }
          callback(data);
        } catch (error) {
          console.error(`Parse error for ${destination}:`, error);
        }
      });

      subscriptionsRef.current.set(destination, subscription);
      console.log(`✅ Subscribed to ${destination}`);
      return subscription;

    } catch (error) {
      console.error(`Subscribe error for ${destination}:`, error);
      return null;
    }
  };

  // Unsubscribe from topic
  const unsubscribe = (destination) => {
    const subscription = subscriptionsRef.current.get(destination);
    if (subscription) {
      try {
        subscription.unsubscribe();
        subscriptionsRef.current.delete(destination);
        console.log(`✅ Unsubscribed from ${destination}`);
      } catch (error) {
        console.error(`Unsubscribe error for ${destination}:`, error);
      }
    }
  };

  // Send message to server
  const sendMessage = (destination, body) => {
    if (!stompClient || !isConnected) {
      console.warn('STOMP not connected, cannot send to:', destination);
      return false;
    }
    
    try {
      const fullDestination = `/app${destination}`;
      stompClient.publish({
        destination: fullDestination,
        body: JSON.stringify(body)
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📤 Sent to ${fullDestination}:`, body);
      }
      return true;
    } catch (error) {
      console.error(`Send error to ${destination}:`, error);
      return false;
    }
  };

  // Get all active subscriptions (for debugging)
  const getSubscriptions = () => {
    return Array.from(subscriptionsRef.current.keys());
  };

  const value = {
    // STOMP specific
    stompClient,
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage,
    getSubscriptions,
    
    // Common
    user,
    onlineUsers,
    connectionAttempts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};