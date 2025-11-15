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

// Helper: Force reload để reset toàn bộ SPA state
const forceReload = (path = '/') => {
  window.location.href = path;
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const dispatch = useDispatch();

  // --- INITIAL LOAD FROM STORAGE ---
  useEffect(() => {
    const loadInitialUser = () => {
      try {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (savedUser && token && token.length > 10) {
          const parsed = JSON.parse(savedUser);
          const normalized = normalizeUserData({ ...parsed, token });
          setCurrentUser(normalized);
          setIsAuthenticated(true);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.error('Failed to load initial user:', err);
      }
    };
    loadInitialUser();
  }, []);

  // --- SYNC MULTI-TAB ---
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'user' || e.key === 'token') {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (savedUser && token) {
          const parsed = JSON.parse(savedUser);
          const normalized = normalizeUserData({ ...parsed, token });
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
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // --- CLEAR ALL APP DATA ---
  const clearAllAppData = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete axios.defaults.headers.common['Authorization'];

    // Clear Service Worker cache (nếu có)
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  }, []);

  // --- CLEAR FRIENDS CACHE ---
  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach((key) => {
      if (/^(friends|pendingRequests|sentRequests)_/.test(key)) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // --- NORMALIZE USER DATA ---
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

  // --- LOGIN ---
  const login = async (email, password) => {
    try {
      clearAllAppData(); // XÓA HOÀN TOÀN TRƯỚC KHI LOGIN
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
        const { token, refreshToken, user } = response.data;

        // Lưu mới
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // RELOAD TRANG ĐỂ RESET TOÀN BỘ STATE
        forceReload('/dashboard');
        return { success: true, user: userWithToken };
      } else {
        throw new Error('Login response did not contain token');
      }
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
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/google`, { token: googleToken });

      if (response.data?.token) {
        const { token, refreshToken, user } = response.data;
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        forceReload('/dashboard');
        return { success: true, user: userWithToken };
      } else {
        throw new Error('No token in response');
      }
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
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/facebook`, { accessToken });

      if (response.data?.token) {
        const { token, refreshToken, user } = response.data;
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        const userWithToken = normalizeUserData({ ...user, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        forceReload('/dashboard');
        return { success: true, user: userWithToken };
      } else {
        throw new Error('No token');
      }
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

    // Reset Redux toàn bộ (nếu có root reset)
    dispatch({ type: 'RESET_APP' }); // hoặc dispatch(resetAll())
    dispatch(resetCourses());

    // Clear all
    clearAllAppData();
    clearFriendsCache();

    forceReload('/login');
  };

  // --- REFRESH USER DATA ---
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
      if (err.response?.status === 401) {
        logout();
      }
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