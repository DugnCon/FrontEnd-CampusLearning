import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Synchronous init from localStorage
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

  // === ĐỒNG BỘ currentUser → localStorage ===
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('user');
    }
  }, [currentUser]);

  // === DỌN CACHE BẠN BÈ ===
  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.match(/^(friends|pendingRequests|sentRequests)_/)) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // === Helper: Normalize user data ===
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

  // === Update user ===
  const updateUser = useCallback((updatedData) => {
    const normalizedData = normalizeUserData(updatedData);
    setCurrentUser(prev => {
      const updated = { ...prev, ...normalizedData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, [normalizeUserData]);

  // === Refresh user data ===
  const refreshUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await axios.get('http://localhost:8080/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        const normalizedUser = normalizeUserData({
          ...response.data,
          token: token
        });
        setCurrentUser(normalizedUser);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        return normalizedUser;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return false;
    }
  }, [normalizeUserData]);

  // === Initial auth check ===
  useEffect(() => {
    if (initialAuthCheckDone || initialUser) return;

    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (savedUser && token) {
      try {
        if (token.length < 10) {
          console.error('Invalid token format found in localStorage');
          clearAuthData();
          setInitialAuthCheckDone(true);
          return;
        }

        const parsedUser = JSON.parse(savedUser);
        const userWithToken = {
          ...parsedUser,
          token: token,
          id: parsedUser.id || parsedUser.userID || parsedUser.userId
        };

        if (!userWithToken.id) {
          console.error('User object does not contain ID information');
          clearAuthData();
          setInitialAuthCheckDone(true);
          return;
        }

        setCurrentUser(userWithToken);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        checkAuth().catch(err => console.error('Background auth check failed:', err));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        clearAuthData();
      }
    }

    setLoading(false);
    setInitialAuthCheckDone(true);
  }, [initialAuthCheckDone, initialUser]);

  // === Clear all auth data + cache ===
  const clearAuthData = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearFriendsCache(); // DỌN CACHE BẠN BÈ
  }, [clearFriendsCache]);

  // === Login ===
  const login = async (email, password) => {
    try {
      setAuthError(null);
      setLoading(true);

      const response = await axios.post('http://localhost:8080/api/auth/login', { email, password });

      if (response.data.twoFaRequired) {
        return { success: true, twoFaRequired: true, tempToken: response.data.tempToken };
      }

      if (response.data.requireTwoFASetup) {
        return { success: true, requireTwoFASetup: true, setupToken: response.data.setupToken, user: response.data.user };
      }

      if (response.data && response.data.token) {
        const token = response.data.token;
        if (token.length < 10) throw new Error('Invalid token');

        localStorage.setItem('token', token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }

        const userData = response.data.user || {};
        if (!userData.id && !userData.userID && !userData.userId) {
          throw new Error('User data does not contain an ID field');
        }

        const userWithToken = normalizeUserData({ ...userData, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: userWithToken };
      } else {
        throw new Error('Login response did not contain token');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setAuthError(errorMessage);

      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 423: return { success: false, error: errorMessage, locked: true, unlockEmailSent: !!data.unlockEmailSent, lockedUntil: data.lockedUntil };
          case 429: return { success: false, error: errorMessage, blocked: true, retryAfter: parseInt(error.response.headers['retry-after'] || '300', 10) };
          case 401: return { success: false, error: errorMessage, attemptsRemaining: data.attemptsRemaining };
          default: return { success: false, error: errorMessage };
        }
      } else {
        return { success: false, error: errorMessage };
      }
    } finally {
      setLoading(false);
    }
  };

  // === OAuth Login (Google, Facebook) ===
  const loginWithGoogle = async (token) => {
    try {
      setAuthError(null);
      setLoading(true);
      if (!token) throw new Error('No Google token');

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await axios.post(`${API_BASE_URL}/api/auth/google`, { token });

      if (response.data && response.data.token) {
        const token = response.data.token;
        if (token.length < 10) throw new Error('Invalid token');

        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userData = response.data.user || {};
        if (!userData.id && !userData.userID && !userData.userId) throw new Error('No ID');

        const userWithToken = normalizeUserData({ ...userData, token });
        localStorage.setItem('user', JSON.stringify(userWithToken));

        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: userWithToken };
      } else {
        throw new Error('No token in response');
      }
    } catch (error) {
      console.error('Google login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Google login failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const loginWithFacebook = async (accessToken) => {
    try {
      setAuthError(null);
      setLoading(true);
      const response = await axios.post('http://localhost:8080/api/auth/facebook', { accessToken });

      if (response.data && response.data.token) {
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
      } else {
        throw new Error('No token');
      }
    } catch (error) {
      console.error('Facebook login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Facebook login failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // === OAuth Connect/Disconnect ===
  const connectOAuthProvider = async (provider, token) => {
    try {
      setAuthError(null);
      setLoading(true);
      const endpoint = provider === 'google' ? 'connect/google' : 'connect/facebook';
      const payload = provider === 'google' ? { token } : { accessToken: token };

      const response = await axios.post(`http://localhost:8080/api/auth/oauth/${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });

      return response.data && response.data.success
        ? { success: true, message: response.data.message }
        : { success: false, error: response.data?.message || 'Failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const disconnectOAuthProvider = async (provider) => {
    try {
      setAuthError(null);
      setLoading(true);
      const response = await axios.delete(`http://localhost:8080/api/auth/oauth/disconnect/${provider}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      return response.data && response.data.success
        ? { success: true, message: response.data.message }
        : { success: false, error: response.data?.message || 'Failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getOAuthConnections = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/auth/oauth/connections', {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      return response.data && response.data.success
        ? { success: true, connections: response.data.connections }
        : { success: false, error: response.data?.message || 'Failed' };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message || 'Failed' };
    }
  };

  // === 2FA Login ===
  const login2Fa = async (tempToken, otp) => {
    try {
      setAuthError(null);
      setLoading(true);
      const response = await axios.post('http://localhost:8080/api/auth/login-2fa', { otp }, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });

      if (response.data.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);

        const userData = response.data.user || {};
        const id = userData.id || userData.userID || userData.userId;
        const userWithToken = { ...userData, token, id, userID: id, userId: id };

        localStorage.setItem('user', JSON.stringify(userWithToken));
        setCurrentUser(userWithToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: userWithToken };
      } else {
        throw new Error(response.data?.message || '2FA failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '2FA failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // === Register ===
  const register = async (userData) => {
    try {
      setAuthError(null);
      setLoading(true);
      const response = await axios.post('http://localhost:8080/api/auth/register', userData);
      return response.data && response.data.success
        ? { success: true, message: response.data.message }
        : { success: false, error: response.data?.message || 'Failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed';
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // === LOGOUT – DỌN SẠCH HẾT ===
  const logout = async () => {
    const token = localStorage.getItem('token');
    const rawApi = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const API_BASE_URL = String(rawApi).replace(/\/$/, '');

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, { timeout: 10000 });
      } catch (err) {
        console.error('[AuthContext] Logout API error:', err);
      }
    }

    // DỌN SẠCH
    dispatch(resetCourses());
    clearAuthData();
    clearFriendsCache();
  };

  // === Check Auth ===
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || token.length < 10) {
        clearAuthData();
        return false;
      }

      const response = await axios.get('http://localhost:8080/api/auth/check', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.success && response.data.user) {
        const userId = response.data.user.id || response.data.user.userID || response.data.user.userId;
        if (!userId) return false;

        const updatedUser = normalizeUserData({ ...response.data.user, token });
        setCurrentUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        clearAuthData();
      }
      return false;
    }
  }, [clearAuthData, normalizeUserData]);

  // === Refresh Token ===
  const refreshUserToken = async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      const token = localStorage.getItem('token');

      if (token && !refreshTokenValue) return true;
      if (!refreshTokenValue) return false;

      const response = await axios.post('http://localhost:8080/api/auth/refresh-token', { refreshToken: refreshTokenValue });
      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      if (error.response && (error.response.status === 400 || error.response.status === 401)) {
        clearAuthData();
      }
      return false;
    }
  };

  const value = {
  user: currentUser, // Đổi từ currentUser → user cho consistent
  currentUser, // Giữ cả hai để backward compatibility
  isAuthenticated,
  loading,
  authError,
  initialAuthCheckDone, // THÊM DÒNG NÀY
  login,
  login2Fa,
  loginWithGoogle,
  loginWithFacebook,
  connectOAuthProvider,
  disconnectOAuthProvider,
  getOAuthConnections,
  register,
  logout,
  checkAuth,
  refreshUserToken,
  updateUser,
  refreshUserData,
  clearFriendsCache
};

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  
  // Trả về cả user và currentUser để backward compatibility
  return {
    ...context,
    user: context.user || context.currentUser,
    currentUser: context.currentUser || context.user
  };
}

export default AuthContext;