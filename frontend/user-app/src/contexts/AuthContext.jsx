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

  // === CLEAR CACHE TOÀN DIỆN ===
  const clearAllUserCache = useCallback(() => {
    console.log('🧹 Clearing ALL user cache from localStorage...');
    
    // Lấy current user ID trước khi clear để log
    const currentUserId = currentUser?.id || currentUser?.userID;
    console.log(`👤 Clearing cache for user: ${currentUserId}`);
    
    // Danh sách tất cả các key cần xóa
    const keysToRemove = [];
    
    // Duyệt qua tất cả keys trong localStorage
    Object.keys(localStorage).forEach(key => {
      // Xóa tất cả cache liên quan đến user data
      if (
        // Cache friends
        key.match(/^(friends|pendingRequests|sentRequests|suggestions)_/) ||
        // Cache profile
        key.match(/^(profile|userProfile|userData|cachedUser)_/) ||
        // Cache chat
        key.match(/^(conversation|chat|message|conversations)_/) ||
        // Cache search
        key.match(/^(search|searchResults)_/) ||
        // Cache global
        key === 'friendsLastFetched' ||
        key === 'lastFetchedUser' ||
        key === 'cachedUserData' ||
        key === 'userSettings' ||
        key === 'recentSearches' ||
        key === 'notificationsCache'
      ) {
        keysToRemove.push(key);
        console.log(`🗑️ Removing cache: ${key}`);
      }
    });

    // Thực hiện xóa
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`✅ Removed ${keysToRemove.length} cache items`);
  }, [currentUser]);

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

  // === CLEAR AUTH DATA TOÀN DIỆN ===
  const clearAuthData = useCallback(() => {
    console.log('🔐 Clearing ALL auth data and cache...');
    
    // Xóa tất cả data authentication
    const authKeys = ['user', 'token', 'refreshToken', 'tempToken', 'setupToken', 'authToken'];
    authKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🔑 Removed auth: ${key}`);
    });
    
    // Xóa tất cả cache user
    clearAllUserCache();
    
    // Xóa headers axios
    delete axios.defaults.headers.common['Authorization'];
    
    // Reset Redux store (nếu có)
    dispatch(resetCourses());
    
    // Reset state
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    
    console.log('✅ All auth data and cache cleared successfully');
  }, [clearAllUserCache, dispatch]);

  // === INITIAL AUTH CHECK ===
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        try {
          // Verify token với server
          const response = await axios.get(`${BASE_URL}/auth/verify-token`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.valid) {
            const userData = JSON.parse(user);
            const normalizedUser = normalizeUserData({ ...userData, token });
            setCurrentUser(normalizedUser);
            setIsAuthenticated(true);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          } else {
            // Token không hợp lệ, clear everything
            clearAuthData();
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          clearAuthData();
        }
      } else {
        // Không có token, đảm bảo mọi thứ được clear
        clearAuthData();
      }
      
      setInitialAuthCheckDone(true);
    };

    checkAuthStatus();
  }, [clearAuthData, normalizeUserData]);

  // === LOGIN ===
  const login = async (email, password) => {
    try {
      setAuthError(null);
      setLoading(true);

      // Clear cache cũ trước khi login mới
      clearAllUserCache();

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

        console.log(`✅ Login successful for user: ${userWithToken.id}`);
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

      // Clear cache cũ trước khi login mới
      clearAllUserCache();

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
        
        console.log(`✅ Google login successful for user: ${userWithToken.id}`);
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

  // === FACEBOOK LOGIN ===
  const loginWithFacebook = async (accessToken) => {
    try {
      setAuthError(null);
      setLoading(true);
      
      // Clear cache cũ trước khi login mới
      clearAllUserCache();

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
        
        console.log(`✅ Facebook login successful for user: ${userWithToken.id}`);
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

  // === LOGOUT TOÀN DIỆN ===
  const logout = async () => {
    console.log('🚪 Logging out user...');
    
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        await axios.post(`${BASE_URL}/auth/logout`, {}, { timeout: 10000 });
        console.log('✅ Logout API call successful');
      } catch (err) {
        console.error('[AuthContext] Logout API error:', err);
      }
    }
    
    // Clear mọi thứ
    clearAuthData();
    
    console.log('✅ Logout completed successfully');
  };

  // === AUTO LOGOUT KHI TOKEN HẾT HẠN ===
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('🔐 Unauthorized access detected - auto logging out');
      logout();
    };

    // Interceptor cho response
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout]);

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
    clearAllUserCache,
    clearAuthData
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