import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';
import { resetNotifications } from '@/store/slices/notificationSlice';
import { resetPosts } from '@/store/slices/postSlice';
import { resetEvents } from '@/store/slices/eventSlice';
import { resetRankings } from '@/store/slices/rankingSlice';
import { resetReports } from '@/store/slices/reportSlice';
import { resetUsers } from '@/store/slices/userSlice';
import { resetExams } from '@/store/slices/examSlice';
import { resetChats } from '@/store/slices/chatSlice';


const AuthContext = createContext();
const BASE_URL = import.meta.env.VITE_API_URL || '/user/api';

export function AuthProvider({ children }) {
  const initialUser = (() => {
    try {
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (savedUser && token && token.length > 10) {
        const parsed = JSON.parse(savedUser);
        return { ...parsed, token, id: parsed.id || parsed.userID || parsed.userId };
      }
    } catch {}
    return null;
  })();

  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialUser);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const dispatch = useDispatch();

  // Sync state with localStorage
  useEffect(() => {
    if (currentUser) localStorage.setItem('user', JSON.stringify(currentUser));
    else localStorage.removeItem('user');
  }, [currentUser]);

  // Multi-tab sync
  useEffect(() => {
    const handler = () => {
      const savedUser = localStorage.getItem('user');
      setCurrentUser(savedUser ? JSON.parse(savedUser) : null);
      setIsAuthenticated(!!savedUser);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.match(/^(friends|pendingRequests|sentRequests)_/)) localStorage.removeItem(key);
    });
  }, []);

  const normalizeUserData = useCallback(userData => {
    if (!userData) return null;
    return {
      ...userData,
      id: userData.id || userData.userID || userData.userId,
      userID: userData.id || userData.userID || userData.userId,
      userId: userData.id || userData.userID || userData.userId,
      avatar: userData.image || userData.avatar || userData.profileImage,
      profileImage: userData.image || userData.avatar || userData.profileImage,
      Image: userData.image || userData.avatar || userData.profileImage
    };
  }, []);

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.clear();
    sessionStorage.clear();
 
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearFriendsCache();
  }, [clearFriendsCache]);

  // --- LOGIN ---
  const login = async (email, password) => {
    try {
      clearAuthData();
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });

      if (response.data.twoFaRequired) {
        return { success: true, twoFaRequired: true, tempToken: response.data.tempToken };
      }

      if (response.data.requireTwoFASetup) {
        return { success: true, requireTwoFASetup: true, setupToken: response.data.setupToken, user: response.data.user };
      }

      if (response.data?.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userWithToken = normalizeUserData({ ...response.data.user, token });
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return { success: true, user: userWithToken };
      } else throw new Error('Login response did not contain token');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE LOGIN ---
  const loginWithGoogle = async (token) => {
    try {
      clearAuthData();
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/google`, { token });

      if (response.data?.token) {
        const newToken = response.data.token;
        localStorage.setItem('token', newToken);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userWithToken = normalizeUserData({ ...response.data.user, token: newToken });
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        return { success: true, user: userWithToken };
      } else throw new Error('No token in response');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Google login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // --- FACEBOOK LOGIN ---
  const loginWithFacebook = async (accessToken) => {
    try {
      clearAuthData();
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/facebook`, { accessToken });

      if (response.data?.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userWithToken = normalizeUserData({ ...response.data.user, token });
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return { success: true, user: userWithToken };
      } else throw new Error('No token');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Facebook login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // --- LOGOUT ---
  const logout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        await axios.post(`${BASE_URL}/auth/logout`, {}, { timeout: 10000 });
      } catch (err) {
        console.error('[AuthContext] Logout API error:', err);
      }
    }
    dispatch(resetCourses());
    dispatch(resetChats());
    dispatch(resetNotifications());
    dispatch(resetPosts());
    dispatch(resetReports());
    dispatch(resetState());
    dispatch(resetExamState());
    clearAuthData();
  };

  // --- REFRESH USER DATA ---
  const refreshUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const res = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data) {
        const normalized = normalizeUserData({ ...res.data, token });
        setCurrentUser(normalized);
        setIsAuthenticated(true);
        return normalized;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  }, [normalizeUserData]);

  const value = {
    user: currentUser,
    currentUser,
    isAuthenticated,
    loading,
    authError,
    login,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
