import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { resetCourses } from '@/store/slices/courseSlice';

const AuthContext = createContext();

// Base URL
const BASE_URL = import.meta.env.VITE_API_URL || '/user/api';

export function AuthProvider({ children }) {

  // -------------------- FIX 1: Không load user cũ lỗi nữa --------------------
  const initialUser = (() => {
    try {
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (savedUser && token && token.length > 10) {
        const parsed = JSON.parse(savedUser);
        return {
          ...parsed,
          token,
          id: parsed.id || parsed.userID || parsed.userId
        };
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

  // Update localStorage when user changes
  useEffect(() => {
    if (currentUser)
      localStorage.setItem('user', JSON.stringify(currentUser));
    else
      localStorage.removeItem('user');
  }, [currentUser]);

  const clearFriendsCache = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.match(/^(friends|pendingRequests|sentRequests)_/))
        localStorage.removeItem(key);
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

  // -------------------- FIX 2: Không merge user cũ + user mới --------------------
  const updateUser = useCallback((updatedData) => {
    const normalized = normalizeUserData(updatedData);
    setCurrentUser(normalized);
    localStorage.setItem('user', JSON.stringify(normalized));
  }, [normalizeUserData]);

  const refreshUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        const normalized = normalizeUserData({ ...response.data, token });
        setCurrentUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
        return normalized;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return false;
    }
  }, [normalizeUserData]);

  // -------------------- FIX 3: Xóa sạch mọi session trước login --------------------
  const clearAuthData = useCallback(() => {
    localStorage.clear(); // Xóa toàn bộ để tránh lỗi cache
    delete axios.defaults.headers.common['Authorization'];

    setCurrentUser(null);
    setIsAuthenticated(false);

    clearFriendsCache();
  }, [clearFriendsCache]);


  // ====================================================================
  //                            LOGIN
  // ====================================================================
  const login = async (email, password) => {
    try {
      setAuthError(null);
      setLoading(true);

      // FIX: trước khi login, clear toàn bộ session cũ
      clearAuthData();

      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password
      });

      if (response.data.twoFaRequired) {
        return { success: true, twoFaRequired: true, tempToken: response.data.tempToken };
      }

      if (response.data.requireTwoFASetup) {
        return {
          success: true,
          requireTwoFASetup: true,
          setupToken: response.data.setupToken,
          user: response.data.user
        };
      }

      if (response.data?.token) {
        const token = response.data.token;

        if (token.length < 10) throw new Error('Invalid token');

        localStorage.setItem('token', token);
        if (response.data.refreshToken)
          localStorage.setItem('refreshToken', response.data.refreshToken);

        const normalized = normalizeUserData({
          ...response.data.user,
          token
        });

        localStorage.setItem('user', JSON.stringify(normalized));
        setCurrentUser(normalized);

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: normalized };
      }

      throw new Error('Login response did not contain token');
    } catch (error) {
      console.error('Login error:', error);
      const msg = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };


  // ====================================================================
  //                        LOGIN WITH GOOGLE
  // ====================================================================
  const loginWithGoogle = async (token) => {
    try {
      setAuthError(null);
      setLoading(true);

      clearAuthData();

      const response = await axios.post(`${BASE_URL}/auth/google`, { token });

      if (response.data?.token) {
        const newToken = response.data.token;
        localStorage.setItem('token', newToken);

        if (response.data.refreshToken)
          localStorage.setItem('refreshToken', response.data.refreshToken);

        const normalized = normalizeUserData({
          ...response.data.user,
          token: newToken
        });

        localStorage.setItem('user', JSON.stringify(normalized));
        setCurrentUser(normalized);

        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setIsAuthenticated(true);

        return { success: true, user: normalized };
      }

      throw new Error('No token in response');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Google login failed';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };


  // ====================================================================
  //                        LOGIN WITH FACEBOOK
  // ====================================================================
  const loginWithFacebook = async (accessToken) => {
    try {
      setAuthError(null);
      setLoading(true);

      clearAuthData();

      const response = await axios.post(`${BASE_URL}/auth/facebook`, {
        accessToken
      });

      if (response.data?.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);

        if (response.data.refreshToken)
          localStorage.setItem('refreshToken', response.data.refreshToken);

        const normalized = normalizeUserData({
          ...response.data.user,
          token
        });

        localStorage.setItem('user', JSON.stringify(normalized));
        setCurrentUser(normalized);

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsAuthenticated(true);

        return { success: true, user: normalized };
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



  // ====================================================================
  //                              LOGOUT
  // ====================================================================
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


  // ====================================================================
  //                         CONTEXT VALUE
  // ====================================================================
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


// -------------------- EXPORT HOOK --------------------
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
