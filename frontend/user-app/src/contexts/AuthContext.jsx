import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';

const AuthContext = createContext();

// Cấu hình base URL
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
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (currentUser) localStorage.setItem('user', JSON.stringify(currentUser));
    else localStorage.removeItem('user');
  }, [currentUser]);

  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.match(/^(friends|pendingRequests|sentRequests)_/)) localStorage.removeItem(key);
    });
  }, []);

  const normalizeUserData = useCallback((userData) => {
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

        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userData = response.data.user || {};
        const userWithToken = normalizeUserData({ ...userData, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: userWithToken };
      } else throw new Error('Login response did not contain token');
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // === GOOGLE LOGIN ===
  const loginWithGoogle = async (token) => {
    try {
      setAuthError(null);
      setLoading(true);

      const response = await axios.post(`${BASE_URL}/auth/google`, { token });

      if (response.data?.token) {
        const newToken = response.data.token;
        localStorage.setItem('token', newToken);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userWithToken = normalizeUserData({ ...response.data.user, token: newToken });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setIsAuthenticated(true);
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
        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);
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
    dispatch(resetCourses());
    clearAuthData();
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
