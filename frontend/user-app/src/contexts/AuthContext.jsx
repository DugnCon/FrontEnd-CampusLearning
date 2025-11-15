import axios from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';

const AuthContext = createContext();
const BASE_URL = import.meta.env.VITE_API_URL || '/user/api';

// Helper: Force reload + cache bust
const forceReload = (path = '/') => {
  const url = `${path}${path.includes('?') ? '&' : '?'}ts=${Date.now()}`;
  window.location.href = url;
};

// Helper: Nuke ALL Chrome cache
const nukeChromeCache = async () => {
  // 1. Xóa storage
  localStorage.clear();
  sessionStorage.clear();

  // 2. Gỡ Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
  }

  // 3. Xóa Cache Storage
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }

  // 4. Xóa IndexedDB
  if ('indexedDB' in window) {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        indexedDB.deleteDatabase(db.name);
      }
    } catch (err) {
      console.warn('IndexedDB cleanup failed:', err);
    }
  }

  // 5. Force reload với cache bust
  forceReload(window.location.pathname);
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const dispatch = useDispatch();

  // --- LOAD INITIAL USER ---
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('token');
        const saved = localStorage.getItem('user');
        if (token && saved) {
          const user = JSON.parse(saved);
          const normalized = normalizeUserData({ ...user, token });
          setCurrentUser(normalized);
          setIsAuthenticated(true);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.error('Load initial user failed:', err);
      }
    };
    loadUser();
  }, []);

  // --- MULTI-TAB SYNC ---
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'user' || e.key === 'token') {
        const token = localStorage.getItem('token');
        const saved = localStorage.getItem('user');
        if (token && saved) {
          const user = JSON.parse(saved);
          const normalized = normalizeUserData({ ...user, token });
          setCurrentUser(normalized);
          setIsAuthenticated(true);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
          setCurrentUser(null);
          setIsAuthenticated(false);
          delete axios.defaults.headers.common['Authorization'];
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // --- CLEAR FRIENDS CACHE ---
  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (/^(friends|pendingRequests|sentRequests)_/.test(key)) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // --- NORMALIZE USER ---
  const normalizeUserData = useCallback((userData) => {
    if (!userData) return null;
    const id = userData.id || userData.userID || userData.userId;
    return {
      ...userData,
      id,
      userID: id,
      userId: id,
      avatar: userData.image || userData.avatar || userData.profileImage || '',
      profileImage: userData.image || userData.avatar || userData.profileImage || '',
      Image: userData.image || userData.avatar || userData.profileImage || '',
    };
  }, []);

  // --- CLEAR ALL APP DATA ---
  const clearAllAppData = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    clearFriendsCache();
  }, [clearFriendsCache]);

  // --- LOGIN ---
  const login = async (email, password) => {
    try {
      clearAllAppData();
      setLoading(true);
      setAuthError(null);

      const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });

      if (response.data.twoFaRequired) {
        return { success: true, twoFaRequired: true, tempToken: response.data.tempToken };
      }

      if (response.data.requireTwoFASetup) {
        return { success: true, requireTwoFASetup: true, setupToken: response.data.setupToken, user: response.data.user };
      }

      if (response.data?.token) {
        const { token, refreshToken, user } = response.data;

        // Lưu dữ liệu mới
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // NUKE TOÀN BỘ CACHE + RELOAD
        nukeChromeCache();

        return { success: true, user: userWithToken };
      }
      throw new Error('No token');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE LOGIN ---
  const loginWithGoogle = async (googleToken) => {
    try {
      clearAllAppData();
      setLoading(true);
      setAuthError(null);

      const response = await axios.post(`${BASE_URL}/auth/google`, { token: googleToken });

      if (response.data?.token) {
        const { token, refreshToken, user } = response.data;
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        nukeChromeCache();
        return { success: true, user: userWithToken };
      }
      throw new Error('No token');
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
      clearAllAppData();
      setLoading(true);
      setAuthError(null);

      const response = await axios.post(`${BASE_URL}/auth/facebook`, { accessToken });

      if (response.data?.token) {
        const { token, refreshToken, user } = response.data;
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        nukeChromeCache();
        return { success: true, user: userWithToken };
      }
      throw new Error('No token');
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
        console.error('Logout API error:', err);
      }
    }

    // Reset Redux toàn bộ
    dispatch({ type: 'RESET_APP' });
    dispatch(resetCourses());

    clearAllAppData();
    forceReload('/login');
  };

  // --- REFRESH USER ---
  const refreshUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const res = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        const normalized = normalizeUserData({ ...res.data, token });
        localStorage.setItem('user', JSON.stringify(normalized));
        setCurrentUser(normalized);
        setIsAuthenticated(true);
        return normalized;
      }
    } catch (err) {
      if (err.response?.status === 401) logout();
      return false;
    }
  }, [normalizeUserData, logout]);

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