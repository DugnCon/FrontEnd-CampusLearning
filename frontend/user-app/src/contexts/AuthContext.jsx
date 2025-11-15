import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';
import { resetChat } from '@/store/slices/chatSlice';
import { resetNotifications } from '@/store/slices/notificationSlice';
import { resetPosts } from '@/store/slices/postSlice';
import { resetReports } from '@/store/slices/reportSlice';
import { resetState } from '@/store/slices/userSlice';
import { resetExamState } from '@/store/slices/examSlice';

const AuthContext = createContext();
const BASE_URL = import.meta.env.VITE_API_URL || '/user/api';

// === TỰ ĐỘNG XÓA SẠCH CACHE ===
const clearAllCaches = async () => {
  // 1. XÓA localStorage + sessionStorage
  localStorage.clear();
  sessionStorage.clear();

  // 2. XÓA Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
  }

  // 3. XÓA Cache Storage (API cache)
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }

  // 4. XÓA IndexedDB
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

  // 5. RELOAD + CACHE BUST
  const bust = Date.now();
  window.location.href = `${window.location.pathname}?_=${bust}`;
};

// === FORCE RELOAD ===
const forceReload = (path = '/') => {
  const url = `${path}${path.includes('?') ? '&' : '?'}ts=${Date.now()}`;
  window.location.href = url;
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);
  const dispatch = useDispatch();

  // === LOAD INITIAL USER ===
  useEffect(() => {
    const loadUser = async () => {
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
      } finally {
        setInitialAuthCheckDone(true);
      }
    };
    loadUser();
  }, []);

  // === MULTI-TAB SYNC (giữ lại để đồng bộ) ===
  useEffect(() => {
    const handleStorage = () => {
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
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (/^(friends|pendingRequests|sentRequests)_/.test(key)) {
        localStorage.removeItem(key);
      }
    });
  }, []);

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

  const updateUser = useCallback((updatedData) => {
    const normalizedData = normalizeUserData(updatedData);
    setCurrentUser(prev => {
      const updated = { ...prev, ...normalizedData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, [normalizeUserData]);

  const refreshUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        const normalizedUser = normalizeUserData({ ...response.data, token });
        setCurrentUser(normalizedUser);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        return normalizedUser;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return false;
    }
  }, [normalizeUserData]);

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearFriendsCache();
  }, [clearFriendsCache]);

  // === LOGIN ===
  const login = async (email, password) => {
    try {
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
        if (token.length < 10) throw new Error('Invalid token');

        // LƯU DỮ LIỆU MỚI
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);
        const userWithToken = normalizeUserData({ ...response.data.user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);

        // TỰ ĐỘNG XÓA SẠCH CACHE + RELOAD
        await clearAllCaches();

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

  // === GOOGLE LOGIN ===
  const loginWithGoogle = async (googleToken) => {
    try {
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/google`, { token: googleToken });

      if (response.data?.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);
        const userWithToken = normalizeUserData({ ...response.data.user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);

        await clearAllCaches(); // TỰ ĐỘNG XÓA
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

  // === FACEBOOK LOGIN ===
  const loginWithFacebook = async (accessToken) => {
    try {
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/facebook`, { accessToken });

      if (response.data?.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);
        const userWithToken = normalizeUserData({ ...response.data.user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setCurrentUser(userWithToken);
        setIsAuthenticated(true);

        await clearAllCaches(); // TỰ ĐỘNG XÓA
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

  // === LOGOUT ===
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

    // RESET REDUX
    dispatch(resetCourses());
    dispatch(resetChat());
    dispatch(resetNotifications());
    dispatch(resetPosts());
    dispatch(resetReports());
    dispatch(resetState());
    dispatch(resetExamState());

    clearAuthData();
    forceReload('/login');
  };

  const value = {
    user: currentUser,
    currentUser,
    isAuthenticated,
    loading,
    authError,
    initialAuthCheckDone,
    login,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    updateUser,
    refreshUserData,
    clearFriendsCache
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return {
    ...context,
    user: context.user || context.currentUser,
    currentUser: context.currentUser || context.user
  };
}

export default AuthContext;