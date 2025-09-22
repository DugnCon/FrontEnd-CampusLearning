/*-----------------------------------------------------------------
* File: SocketContext.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Context provider for managing Socket.IO connection.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { handleSocketGracefully } from '../utils/errorHandling';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const MAX_RETRY_ATTEMPTS = 3;

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!storedUser || !token) return;

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Khởi tạo kết nối socket.io
      const socketInstance = io(API_URL.replace('/api', ''), {
        auth: { token },
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: MAX_RETRY_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
      });

      // Gắn xử lý lỗi chung
      handleSocketGracefully(socketInstance, (error) => {
        console.warn('Socket error handled silently:', error.message);
        if (
          !error.message.includes('ECONNREFUSED') &&
          !error.message.includes('xhr poll error')
        ) {
          setConnectionAttempts((prev) => prev + 1);
        }
      });

      // Event: kết nối thành công
      socketInstance.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
        setConnectionAttempts(0);
      });

      // Event: mất kết nối
      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      // Event: nhận danh sách user online
      socketInstance.on('getUsers', (users) => {
        setOnlineUsers(users);
      });

      // Event: lỗi khi connect
      socketInstance.on('connect_error', (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Socket connection error:', error.message);
        }
        setIsConnected(false);

        if (
          !error.message.includes('ECONNREFUSED') &&
          !error.message.includes('xhr poll error') &&
          !error.message.includes('WebSocket is closed')
        ) {
          setConnectionAttempts((prev) => prev + 1);
        }

        // fallback sang polling nếu WebSocket fail
        if (
          error.message.includes('WebSocket is closed') &&
          socketInstance.io.opts.transports.includes('polling')
        ) {
          console.log('WebSocket failed, falling back to polling');
          socketInstance.io.opts.transports = ['polling'];
          socketInstance.connect();
        }
      });

      // Lưu instance socket vào state
      setSocket(socketInstance);

      // Cleanup khi unmount
      return () => {
        if (socketInstance) {
          try {
            socketInstance.disconnect();
          } catch (err) {
            console.warn('Error during socket cleanup:', err.message);
          }
        }
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error setting up socket:', error.message);
      }
    }
  }, []);

  // Tự động reconnect khi token thay đổi
  useEffect(() => {
    if (!socket) return;
    if (isConnected || connectionAttempts >= MAX_RETRY_ATTEMPTS) return;

    const token = localStorage.getItem('token');
    if (token) {
      try {
        socket.auth = { token };
        socket.connect();
      } catch (err) {
        console.warn('Reconnect failed:', err.message);
      }
    }
  }, [socket, isConnected, connectionAttempts]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        user,
        onlineUsers,
        isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
