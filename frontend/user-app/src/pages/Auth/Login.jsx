/*-----------------------------------------------------------------
* File: Login.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockClosedIcon, ExclamationCircleIcon, FingerPrintIcon } from '@heroicons/react/24/outline';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/slices/authSlice';
import { GoogleLogin } from '@react-oauth/google';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../../components/common/Loading';
import About from '../../components/common/About';
import Avatar from '../../components/common/Avatar';

// Check if passkey is supported by the browser
const isPasskeySupported = () => {
  // Check for basic PublicKeyCredential support
  const hasCredentials = typeof window.PublicKeyCredential !== 'undefined';
  // Check for isUserVerifyingPlatformAuthenticatorAvailable (needed for biometrics)
  const hasBiometricCheck = hasCredentials && 
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
  
  console.log('WebAuthn Support Check:', { 
    hasCredentials, 
    hasBiometricCheck
  });
  
  return hasCredentials;
};

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, login2Fa, isAuthenticated, loginWithGoogle } = useAuth();
  const dispatch = useDispatch();

  // Redirect to home if already authenticated (also covers account-selection screen)
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const maxBiometricAttempts = 3;
  const biometricTimeoutRef = useRef(null);
  const emailInputRef = useRef(null);
  const [twoFaStage, setTwoFaStage] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');
  const [successLoading, setSuccessLoading] = useState(false);
  const [accountsWithPasskey, setAccountsWithPasskey] = useState(new Set());
  // Create refs for 2FA inputs and handler for auto-submit
  const inputsRef = useRef([]);
  const handleTwoFaInput = (e, idx) => {
    const val = e.target.value.replace(/\D/, '');
    
    // Update the code array
    const codeArr = twoFaCode.split('');
    codeArr[idx] = val;
    const newCode = codeArr.join('').slice(0, 6);
    setTwoFaCode(newCode);
    
    // If we have a value, move to next input
    if (val && idx < 5) {
      inputsRef.current[idx + 1].focus();
    }
    
    // If we have a complete 6-digit code, try to auto-verify
    if (newCode.length === 6) {
      autoVerifyTwoFa(newCode);
    }
  };
  const autoVerifyTwoFa = async (code) => {
    setTwoFaLoading(true);
    setTwoFaError('');
    try {
      const result = await login2Fa(tempToken, code);
      if (result.success) {
        setTwoFaLoading(false);
        handleLoginSuccess(result.user);
      }
      else {
        setTwoFaError(result.error || 'Xác thực 2FA thất bại');
        // Clear the code when verification fails
        clearTwoFaCode();
        setTwoFaLoading(false);
      }
    } catch (err) {
      setTwoFaError(err.message || 'Xác thực 2FA thất bại');
      // Clear the code when verification fails
      clearTwoFaCode();
      setTwoFaLoading(false);
    }
  };

  // Update to handle backspace key better
  const handleTwoFaKeyDown = (e, idx) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      const codeArr = twoFaCode.split('');
      
      // If current field has a value, clear it
      if (codeArr[idx]) {
        codeArr[idx] = '';
        setTwoFaCode(codeArr.join(''));
      } 
      // If current field is empty and not the first field, move to previous field
      else if (idx > 0) {
        codeArr[idx - 1] = '';
        setTwoFaCode(codeArr.join(''));
        inputsRef.current[idx - 1].focus();
      }
    }
  };

  // Function to clear the 2FA code and focus on the first input
  const clearTwoFaCode = () => {
    setTwoFaCode('');
    // Focus on the first input field after a short delay to ensure UI has updated
    setTimeout(() => {
      if (inputsRef.current[0]) {
        inputsRef.current[0].focus();
      }
    }, 50);
  };

  // Check if browser supports passkeys and platform authenticator (biometrics)
  useEffect(() => {
    // Basic WebAuthn support check
    const hasBasicSupport = isPasskeySupported();
    setIsPasskeyAvailable(hasBasicSupport);
    
    // Additionally check for platform authenticator (biometrics)
    if (hasBasicSupport && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => {
          console.log(`Platform authenticator (biometrics) available: ${available}`);
          // We'll still enable the button even if platform authenticator isn't available,
          // as the user might have a security key or other authenticator
        })
        .catch(err => {
          console.error('Error checking platform authenticator:', err);
        });
    }
  }, []);

  // Clear timeout on component unmount
  useEffect(() => {
    return () => {
      if (biometricTimeoutRef.current) {
        clearTimeout(biometricTimeoutRef.current);
      }
    };
  }, []);

  // Check if there's a message in location state and handle redirect only once
  useEffect(() => {
    if (location.state?.message) {
      setRedirectMessage(location.state.message);
    }
    
    // If user is already authenticated, redirect to home page
    // But only do this check once when component mounts
    if (isAuthenticated && !authChecked) {
      navigate('/', { replace: true });
    }
    
    setAuthChecked(true);
  }, [location, isAuthenticated, navigate, authChecked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      // Handle first-time 2FA setup requirement
      if (result.success && result.requireTwoFASetup) {
        navigate('/setup-2fa', { state: { setupToken: result.setupToken } });
      } else if (result.success && result.twoFaRequired) {
        setTwoFaStage(true);
        setTempToken(result.tempToken);
      } else if (result.success) {
        // Add password to the user object if remember is checked
        if (formData.remember) {
          result.user.hasStoredPassword = true;
          result.user.storedPassword = btoa(formData.password);
        }
        handleLoginSuccess(result.user);
      } else {
        // Handle specific error types
        if (result.locked || result.blocked) {
          // Account locked or IP blocked
          if (result.unlockEmailSent) {
            setError(`${result.error} Chúng tôi đã gửi hướng dẫn mở khóa qua email của bạn.`);
          } else if (result.retryAfter) {
            const minutes = Math.ceil(result.retryAfter / 60);
            setError(`${result.error} Vui lòng thử lại sau ${minutes} phút.`);
          } else {
            setError(result.error);
          }
        } else if (result.attemptsRemaining !== undefined) {
          // Show remaining attempts warning with increasing severity
          if (result.attemptsRemaining <= 2) {
            // Critical warning - last attempts
            setError(
              <div className="text-red-600 font-bold">
                {result.error}
                <div className="mt-1 text-sm bg-red-100 p-2 rounded border border-red-300">
                  <span className="font-bold">⚠️ Cảnh báo:</span> Tài khoản sẽ bị khóa sau {result.attemptsRemaining} lần đăng nhập thất bại nữa!
                </div>
              </div>
            );
          } else if (result.attemptsRemaining <= 3) {
            // Warning - getting close to lockout
            setError(
              <div>
                {result.error}
                <div className="mt-1 text-sm text-amber-700 font-semibold">
                  ⚠️ Còn lại {result.attemptsRemaining} lần thử trước khi tài khoản bị khóa.
                </div>
              </div>
            );
          } else {
            // Standard notice
            setError(`${result.error} Còn lại ${result.attemptsRemaining} lần thử.`);
          }
        } else {
          setError(result.error || 'Đăng nhập thất bại');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle different HTTP status codes
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        switch (status) {
          case 423: // Account locked
            if (data.unlockEmailSent) {
              setError(`${data.message} Chúng tôi đã gửi hướng dẫn mở khóa qua email của bạn.`);
            } else {
              setError(data.message || 'Tài khoản đã bị khóa tạm thời');
            }
            break;
          case 429: // Too many requests (IP blocked)
            const retryAfter = parseInt(error.response.headers['retry-after'] || '300', 10);
            const minutes = Math.ceil(retryAfter / 60);
            setError(`${data.message || 'Quá nhiều lần thử. Vui lòng thử lại sau.'} (${minutes} phút)`);
            break;
          case 401: // Unauthorized
            if (data.attemptsRemaining !== undefined) {
              if (data.attemptsRemaining <= 2) {
                // Critical warning - last attempts
                setError(
                  <div className="text-red-600 font-bold">
                    {data.message}
                    <div className="mt-1 text-sm bg-red-100 p-2 rounded border border-red-300">
                      <span className="font-bold">⚠️ Cảnh báo:</span> Tài khoản sẽ bị khóa sau {data.attemptsRemaining} lần đăng nhập thất bại nữa!
                    </div>
                  </div>
                );
              } else if (data.attemptsRemaining <= 3) {
                // Warning - getting close to lockout
                setError(
                  <div>
                    {data.message}
                    <div className="mt-1 text-sm text-amber-700 font-semibold">
                      ⚠️ Còn lại {data.attemptsRemaining} lần thử trước khi tài khoản bị khóa.
                    </div>
                  </div>
                );
              } else {
                // Standard notice
                setError(`${data.message} Còn lại ${data.attemptsRemaining} lần thử.`);
              }
            } else {
              setError(data.message || 'Email hoặc mật khẩu không chính xác');
            }
            break;
          case 403: // Forbidden (account suspended)
            setError(data.message || 'Tài khoản không khả dụng');
            break;
          default:
            setError(data.message || error.message || 'Đăng nhập thất bại');
        }
      } else {
      setError(error.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = useCallback((userData) => {
    // Log incoming userData for debugging
    console.log('handleLoginSuccess called with:', userData);
    if (userData.accountStatus === 'LOCKED') {
    setError('Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.');
    setSuccessLoading(false);
    return;
    }
    // Show success loading for 1.5 seconds before completing login
    setSuccessLoading(true);
    
    setTimeout(() => {
      // Ensure user data has the required fields
      const processedUserData = {
        ...userData,
        // Ensure consistent field naming (backend might use different formats)
        id: userData.id || userData.UserID,
        UserID: userData.UserID || userData.id,
        username: userData.username || userData.Username,
        email: userData.email || userData.Email,
        // Normalize fullName fields
        fullName: userData.fullName || userData.FullName || userData.username || userData.Username,
        FullName: userData.fullName || userData.FullName || userData.username || userData.Username,
        // Normalize avatar/image fields for consistency
        avatar: userData.Image || userData.avatar || userData.profileImage,
        profileImage: userData.Image || userData.avatar || userData.profileImage,
        Image: userData.Image || userData.avatar || userData.profileImage,
        role: (userData.role || userData.Role || 'STUDENT').toUpperCase(),
        token: userData.token,
      };
      
      // Store user data and token in Redux
      dispatch(setUser(processedUserData));
      
      // Persist token and user in localStorage for future sessions
      if (processedUserData.token) {
        localStorage.setItem('token', processedUserData.token);
        localStorage.setItem('authToken', processedUserData.token);
      }
      
      // Store complete user data
      localStorage.setItem('user', JSON.stringify(processedUserData));
      
      // Show success toast
      toast.success('Đăng nhập thành công!');
      
      // Log that we're about to navigate
      console.log('Navigating to home page after successful login');
      
      // Navigate with replace to prevent going back to login page
      navigate('/home', { replace: true });
      
      // Ensure navigation happens even if there's an issue with the first attempt
      setTimeout(() => {
        if (window.location.pathname.includes('/login')) {
          console.log('Backup navigation triggered');
          navigate('/home', { replace: true });
        }
      }, 500);
      
      // Store into previousAccounts in localStorage
      const storedAccounts = JSON.parse(localStorage.getItem('previousAccounts') || '[]');
      const updatedAccounts = storedAccounts.filter(acc => acc.email !== (userData.email || userData.Email));
      
      // Check if we need to keep the stored password
      const hasStoredPassword = userData.hasStoredPassword === true;
      const storedPassword = hasStoredPassword ? userData.storedPassword : null;
      
      // Add the current account with the saved password if remember is true
      const savedAccount = {
        ...userData,
        email: userData.email || userData.Email,
        username: userData.username || userData.Username || '',
        fullName: userData.fullName || userData.FullName || '',
        FullName: userData.fullName || userData.FullName || '',
        // Save avatar/profile image fields
        avatar: userData.avatar || userData.profileImage || userData.Image || '',
        profileImage: userData.avatar || userData.profileImage || userData.Image || '',
        Image: userData.avatar || userData.profileImage || userData.Image || '',
        // Save password if specified in userData or from formData
        hasStoredPassword: hasStoredPassword,
        storedPassword: storedPassword,
        token: userData.token,
        lastLogin: new Date().toISOString()
      };
      
      updatedAccounts.unshift(savedAccount);
      localStorage.setItem('previousAccounts', JSON.stringify(updatedAccounts.slice(0, 3)));
    }, 1500);
  }, [dispatch, navigate]);

  const loginWithPasskey = async () => {
    // Check if max attempts reached
    if (biometricAttempts >= maxBiometricAttempts) {
      toast.error('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
      return;
    }

    // Verify browser support first
    if (!window.PublicKeyCredential) {
      toast.error('Trình duyệt của bạn không hỗ trợ xác thực sinh trắc học.');
      console.error('WebAuthn is not supported in this browser');
      return;
    }

    setError('');
    
    // Ensure email is provided to fetch authentication options
    if (!formData.email) {
      setError('Vui lòng nhập email để đăng nhập bằng sinh trắc học');
      toast.error('Vui lòng nhập email trước khi sử dụng sinh trắc học');
      // Focus on the email input
      if (emailInputRef.current) {
        emailInputRef.current.focus();
      }
      return;
    }
    
    try {
      // Set loading state for the fingerprint button only
      setPasskeyLoading(true);
      
      let options;
      console.log(`Requesting authentication options for email: ${formData.email}`);
      try {
        // Get the API base URL from environment or use a fallback
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        console.log(`Using API base URL: ${API_BASE_URL}`);
        
        const optionsResponse = await axios.post(`${API_BASE_URL}/passkeys/auth/options`, {
          email: formData.email
        });
        console.log('Server response for auth options:', optionsResponse.data);
        if (!optionsResponse.data.success) {
          throw new Error(optionsResponse.data.message || 'Không thể tạo yêu cầu xác thực');
        }
        options = optionsResponse.data.options;
      } catch (apiError) {
        console.error('Error fetching authentication options:', apiError);
        if (apiError.response) {
          console.error('Server response:', apiError.response.data);
          console.error('Status code:', apiError.response.status);
        } else if (apiError.request) {
          console.error('No response received:', apiError.request);
          console.error('Network error or server not running');
        } else {
          console.error('Error setting up request:', apiError.message);
        }
        throw new Error(`Lỗi khi lấy thông tin xác thực: ${apiError.message}`);
      }

      // Step 2: Create credentials with WebAuthn API
      try {
        // Convert base64url challenge to Uint8Array
        options.challenge = Uint8Array.from(
          atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), 
          c => c.charCodeAt(0)
        );

        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map(credential => {
            return {
              ...credential,
              id: Uint8Array.from(
                atob(credential.id.replace(/-/g, '+').replace(/_/g, '/')), 
                c => c.charCodeAt(0)
              )
            };
          });
        }
      } catch (encodingError) {
        console.error('Error preparing WebAuthn options:', encodingError);
        throw new Error('Lỗi định dạng dữ liệu xác thực');
      }

      // Tell the user what's happening
      toast('Vui lòng xác thực bằng sinh trắc học của thiết bị khi được yêu cầu');

      // Request authentication from browser - this will trigger the OS biometric prompt
      // This is a blocking call - it will wait for the user to provide biometric input
      // IMPORTANT: At this point, the device's native biometric UI (TouchID/FaceID/etc.) will appear
      console.log('🔐 Activating device biometric authentication - watch for native OS prompt');
      console.log('Authentication options:', JSON.stringify({
        ...options,
        challenge: 'Uint8Array',
        allowCredentials: options.allowCredentials ? 'Array of credentials' : undefined
      }));
      
      // Force a slight delay to ensure UI updates before the potentially blocking credential.get call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The native biometric prompt should appear after this call
      const credential = await navigator.credentials.get({
        publicKey: options
      });

      // If we got here, the user has successfully provided their fingerprint/biometric through the device's hardware
      console.log('✅ Native biometric authentication successful - processing server verification');

      // Step 3: Prepare credential for server verification
      let authResponse;
      try {
        authResponse = {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          response: {
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            userHandle: credential.response.userHandle
              ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
              : null
          },
          type: credential.type
        };
      } catch (encodingError) {
        console.error('Error encoding credential for server:', encodingError);
        throw new Error('Lỗi xử lý dữ liệu sinh trắc học');
      }

      // Step 4: Send response to server for verification
      let verifyResponse;
      try {
        // Get the API base URL from environment or use a fallback
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        
        verifyResponse = await axios.post(`${API_BASE_URL}/passkeys/auth/verify`, {
          email: formData.email,
          response: authResponse
        });
        
        console.log('Server verification response:', verifyResponse.data);

        if (!verifyResponse.data.success) {
          throw new Error(verifyResponse.data.message || 'Xác thực không thành công');
        }
      } catch (apiError) {
        console.error('Error during server verification:', apiError);
        if (apiError.response) {
          console.error('Server response:', apiError.response.data);
          console.error('Status code:', apiError.response.status);
        } else if (apiError.request) {
          console.error('No response received:', apiError.request);
        } else {
          console.error('Error setting up request:', apiError.message);
        }
        throw new Error(`Lỗi xác thực với máy chủ: ${apiError.message}`);
      }

      // Authentication successful - reset attempts
      setBiometricAttempts(0);

      // Handle successful login
      const { user, tokens } = verifyResponse.data;
      
      // Build full user object with token
      const userWithToken = { 
        ...user, 
        token: tokens.accessToken,
        // Ensure these critical fields are available for the app's authentication system
        UserID: user.id,
        username: user.username,
        role: user.role || 'STUDENT',
      };
      
      console.log('Constructed user object for login:', userWithToken);
      
      // Store tokens in localStorage directly for extra safety
      localStorage.setItem('token', tokens.accessToken);
      localStorage.setItem('authToken', tokens.accessToken);
      
      // Handle successful login via passkey
      handleLoginSuccess(userWithToken);
      
      toast.success('Đăng nhập bằng sinh trắc học thành công!');
      
      // Track this email as passkey-enabled for future reference
      const storedPasskeyAccounts = JSON.parse(localStorage.getItem('passkeyEnabledAccounts') || '[]');
      const updatedPasskeyAccounts = [...storedPasskeyAccounts, formData.email];
      localStorage.setItem('passkeyEnabledAccounts', JSON.stringify([...new Set(updatedPasskeyAccounts)]));
      addToPasskeyAccounts(formData.email);
      
      // Add a direct navigation as backup in case handleLoginSuccess doesn't redirect
      setTimeout(() => {
        if (window.location.pathname.includes('/login')) {
          console.log('Backup navigation to home triggered');
          navigate('/home', { replace: true });
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Passkey authentication error:', error);
      
      // Increment failed attempts
      const newAttempts = biometricAttempts + 1;
      setBiometricAttempts(newAttempts);
      
      // Check if max attempts reached
      if (newAttempts >= maxBiometricAttempts) {
        setError('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
        toast.error('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
      } else {
        // Provide more helpful error messages based on common WebAuthn errors
        let errorMessage = `Xác thực sinh trắc học thất bại (lần thử ${newAttempts}/${maxBiometricAttempts}).`;
        
        if (error.name === 'NotAllowedError') {
          errorMessage += ' Người dùng từ chối xác thực hoặc không có sinh trắc học được đăng ký.';
        } else if (error.name === 'SecurityError') {
          errorMessage += ' Lỗi bảo mật: yêu cầu xác thực phải đến từ nguồn an toàn (HTTPS).';
        } else if (error.name === 'AbortError') {
          errorMessage += ' Xác thực bị hủy.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage += ' Phương thức xác thực không được hỗ trợ.';
        } else {
          errorMessage += ` ${error.message || ''}`;
        }
        
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setPasskeyLoading(false);
      
      // Remove the timeout for hiding the prompt
      if (biometricTimeoutRef.current) {
        clearTimeout(biometricTimeoutRef.current);
        biometricTimeoutRef.current = null;
      }
    }
  };

  // Handle OTP login button click (request OTP)
  const handleLoginOtp = () => {
    // Điều hướng sang trang đăng nhập OTP
    navigate('/login-otp', { state: { email: formData.email } });
  };

  // Update handleTwoFaVerify to clear the code on failure
  const handleTwoFaVerify = async (e) => {
    e.preventDefault();
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const result = await login2Fa(tempToken, twoFaCode);
      if (result.success) {
        setTwoFaLoading(false);
        handleLoginSuccess(result.user);
      } else {
        setTwoFaError(result.error || 'Xác thực 2FA thất bại');
        // Clear the code when verification fails
        clearTwoFaCode();
        setTwoFaLoading(false);
      }
    } catch (error) {
      setTwoFaError(error.message || 'Xác thực 2FA thất bại');
      // Clear the code when verification fails
      clearTwoFaCode();
      setTwoFaLoading(false);
    }
  };

  // Handle Google login success for connection
  const handleGoogleSuccess = async (response) => {
    try {
      console.log('Google login callback received:', response);
      setLoading(true);
      setError('');
      
      if (!response || !response.credential) {
        toast.error('Google login failed. Missing credentials.');
        return;
      }
      
      const result = await loginWithGoogle(response.credential);
      
      if (result.success) {
        // Log success for debugging
        console.log('Google login successful:', result);
        handleLoginSuccess(result.user);
        
        // Force navigation and clear any URL parameters
        navigate('/home', { replace: true });
      } else {
        toast.error(result.error || 'Google login failed');
        setError(result.error || 'Google login failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error(error.message || 'Google login failed');
      setError(error.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleIdToken = async (idToken) => {
    console.log('🎯 [FRONTEND] handleGoogleIdToken called with ID token');
    try {
      setLoading(true);
      setError('');
      
      console.log('📡 [FRONTEND] Sending Google ID token to Spring backend...');
      
      // Gửi ID token đến Spring backend
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: idToken // Spring endpoint expect "token" field
        }),
      });
      
      console.log('📨 [FRONTEND] Spring backend response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ [FRONTEND] Spring backend response:', result);
      
      if (result.success) {
        console.log('🎉 [FRONTEND] Google login successful via Spring');
        console.log('🔑 [FRONTEND] JWT token received from Spring:', result.token);
        console.log('👤 [FRONTEND] User data received:', result.user);
        
        // Lưu JWT từ Spring vào localStorage
        localStorage.setItem('token', result.token);
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Update Redux store
        dispatch(setUser(result.user));
        
        toast.success('Google login successful!');
        
        // Force navigation to home
        console.log('🔄 [FRONTEND] Navigating to home page...');
        navigate('/home', { replace: true });
        
      } else {
        console.error('❌ [FRONTEND] Spring backend returned error:', result.message);
        throw new Error(result.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Google ID token authentication failed:', error);
      toast.error('Google login failed');
      setError('Google login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login error
  const handleGoogleError = () => {
    toast.error('Google login failed. Please try again.');
    setError('Google login failed. Please try again.');
  };

  // Handle Facebook login
  const handleFacebookLogin = async (response) => {
    try {
      if (response.accessToken) {
        const result = await loginWithFacebook(response.accessToken);
        
        if (result.success) {
          handleLoginSuccess(result.user);
        } else {
          toast.error(result.error || 'Facebook login failed');
        }
      } else {
        toast.error('Facebook login failed. No access token received.');
      }
    } catch (error) {
      console.error('Facebook login error:', error);
      toast.error(error.message || 'Facebook login failed');
    }
  };

  // Handle Google OAuth redirect response
  useEffect(() => {
    // Check if there's a hash fragment in the URL (from Google OAuth redirect)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Log for debugging
    if (hash || searchParams.toString()) {
      console.log('Detected OAuth response:', { 
        hash: hash || 'none', 
        search: searchParams.toString() || 'none' 
      });
    }
    
    if (hash) {
      try {
        const params = new URLSearchParams(hash.substring(1)); // Remove #
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (idToken) {
          console.log('Found ID token in URL hash, processing Google login');
          // Set loading state
          setLoading(true);
          
          // Send idToken directly to backend for verification
          handleGoogleSuccess({ credential: idToken });
          
          // Clean URL immediately to prevent re-processing on navigation
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (accessToken) {
          console.log('Found access token in URL hash, fetching user info');
          setLoading(true);
          
          // Fallback: fetch user info and process login
          fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`)
            .then(res => res.json())
            .then(data => {
              console.log('Retrieved Google user info:', data);
              const credential = {
                credential: accessToken,
                clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                select_by: 'user',
                ...data,
              };
              handleGoogleSuccess({ credential });
            })
            .catch(err => {
              console.error('Error fetching Google user info:', err);
              toast.error('Failed to get Google user information');
              setError('Failed to get Google user information');
              setLoading(false);
            })
            .finally(() => {
              // Clean URL
              window.history.replaceState({}, document.title, window.location.pathname);
            });
        }
      } catch (error) {
        console.error('Error processing OAuth response:', error);
        toast.error('Failed to process login response');
        setError('Failed to process login response');
        setLoading(false);
      }
    }
    
    // Also check for code parameter (used in some OAuth flows)
    const code = searchParams.get('code');
    if (code) {
      console.log('Found authorization code in URL, processing OAuth login');
      // Here you would send the code to your backend for token exchange
      // For now, just clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [previousAccounts, setPreviousAccounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('previousAccounts') || '[]');
    } catch {
      return [];
    }
  });
  const [showLoginForm, setShowLoginForm] = useState(previousAccounts.length === 0);

  // State for selected account that needs password input
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedAccountPassword, setSelectedAccountPassword] = useState('');
  const [selectedAccountLoading, setSelectedAccountLoading] = useState(false);
  const [selectedAccountError, setSelectedAccountError] = useState('');

  // Add handler for choosing a previous account
  const handleAccountClick = async (account) => {
    try {
      // Show loading toast
      toast.loading("Đang xử lý...", { id: "accountLogin" });
      
      // Check if we have a stored password for this account
      if (account.hasStoredPassword && account.storedPassword) {
        // We have a stored password, attempt to log in directly
        setSelectedAccountLoading(true);
        
        try {
          // Decode the stored password
          const decodedPassword = atob(account.storedPassword);
          
          // Attempt to login with stored credentials
          const result = await login(account.email, decodedPassword);
          
          if (result.success && result.twoFaRequired) {
            // If 2FA is required, show 2FA form
            toast.dismiss("accountLogin");
            toast.success("Vui lòng nhập mã xác thực 2FA");
            // Switch to main login form to display 2FA UI
            setShowLoginForm(true);
            setTwoFaStage(true);
            setTempToken(result.tempToken);
          } else if (result.success) {
            // Login successful - ensure we preserve the stored password flag
            toast.dismiss("accountLogin");
            toast.success("Đăng nhập thành công");
            
            // Ensure password storage information is passed along
            result.user.hasStoredPassword = true;
            result.user.storedPassword = account.storedPassword;
            
            handleLoginSuccess(result.user);
            
            // Ensure navigation happens
            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 300);
          } else {
            // Login failed with saved password - password might have changed
            toast.dismiss("accountLogin");
            toast.error("Mật khẩu đã thay đổi hoặc hết hạn. Vui lòng nhập lại.");
            setSelectedAccount(account);
            setSelectedAccountError('Phiên đăng nhập đã hết hạn, vui lòng nhập mật khẩu');
          }
        } catch (error) {
          // Error during login with stored password
          console.error("Error logging in with saved credentials:", error);
          toast.dismiss("accountLogin");
          toast.error("Lỗi đăng nhập. Vui lòng thử lại.");
          setSelectedAccount(account);
          setSelectedAccountError('Đã xảy ra lỗi, vui lòng nhập mật khẩu để tiếp tục');
        }
      } else {
        // No stored password, show password form
        toast.dismiss("accountLogin");
        setSelectedAccount(account);
        // Pre-select the remember checkbox if the account had it stored before
        setFormData(prev => ({...prev, remember: account.hasStoredPassword || false}));
        setSelectedAccountError('Vui lòng nhập mật khẩu để tiếp tục');
      }
    } catch (error) {
      toast.dismiss("accountLogin");
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
      console.error("Error handling account selection:", error);
      setSelectedAccount(account);
    } finally {
      setSelectedAccountLoading(false);
    }
  };

  // Handler for login with selected account after password entry
  const handleSelectedAccountLogin = async (e) => {
    e.preventDefault();
    
    if (!selectedAccount || !selectedAccountPassword) {
      setSelectedAccountError('Vui lòng nhập mật khẩu');
      return;
    }
    
    setSelectedAccountLoading(true);
    setSelectedAccountError('');
    
    try {
      const result = await login(selectedAccount.email, selectedAccountPassword);
      
      // Handle first-time 2FA setup requirement
      if (result.success && result.requireTwoFASetup) {
        toast.success("Đăng nhập thành công nhưng bạn cần thiết lập xác thực hai lớp (2FA)");
        navigate('/setup-2fa', { state: { setupToken: result.setupToken } });
        setSelectedAccount(null);
      } else if (result.success && result.twoFaRequired) {
        // If 2FA is required, show 2FA form
        toast.success("Vui lòng nhập mã xác thực 2FA");
        // Switch to main login form to display 2FA UI
        setShowLoginForm(true);
        setTwoFaStage(true);
        setTempToken(result.tempToken);
        setSelectedAccount(null); // Clear selected account since we're moving to 2FA
      } else if (result.success) {
        // Login successful
        toast.success("Đăng nhập thành công!");
        
        // Update remember status based on current form setting
        result.user.hasStoredPassword = formData.remember;
        result.user.storedPassword = formData.remember ? btoa(selectedAccountPassword) : null;
        
        handleLoginSuccess(result.user);
        setSelectedAccount(null);
        
        // Ensure navigation happens
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 300);
      } else {
        // Login failed
        setSelectedAccountError(result.error || 'Mật khẩu không chính xác');
      }
    } catch (error) {
      setSelectedAccountError(error.message || 'Đăng nhập thất bại');
    } finally {
      setSelectedAccountLoading(false);
    }
  };

  // Return to account selection from password screen
  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setSelectedAccountPassword('');
    setSelectedAccountError('');
  };

  // Biometric login for selected account
  const loginWithPasskeyForAccount = async (account) => {
    // Check if max attempts reached
    if (biometricAttempts >= maxBiometricAttempts) {
      toast.error('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
      return;
    }

    // Verify browser support first
    if (!window.PublicKeyCredential) {
      toast.error('Trình duyệt của bạn không hỗ trợ xác thực sinh trắc học.');
      console.error('WebAuthn is not supported in this browser');
      return;
    }

    setSelectedAccountError('');
    
    try {
      // Set loading state for the fingerprint button only
      setPasskeyLoading(true);
      
      let options;
      console.log(`Requesting authentication options for email: ${account.email}`);
      try {
        // Get the API base URL from environment or use a fallback
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        console.log(`Using API base URL: ${API_BASE_URL}`);
        
        const optionsResponse = await axios.post(`${API_BASE_URL}/passkeys/auth/options`, {
          email: account.email
        });
        console.log('Server response for auth options:', optionsResponse.data);
        if (!optionsResponse.data.success) {
          throw new Error(optionsResponse.data.message || 'Không thể tạo yêu cầu xác thực');
        }
        options = optionsResponse.data.options;
      } catch (apiError) {
        console.error('Error fetching authentication options:', apiError);
        throw new Error(`Lỗi khi lấy thông tin xác thực: ${apiError.message}`);
      }

      // Step 2: Create credentials with WebAuthn API
      try {
        // Convert base64url challenge to Uint8Array
        options.challenge = Uint8Array.from(
          atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), 
          c => c.charCodeAt(0)
        );

        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map(credential => {
            return {
              ...credential,
              id: Uint8Array.from(
                atob(credential.id.replace(/-/g, '+').replace(/_/g, '/')), 
                c => c.charCodeAt(0)
              )
            };
          });
        }
      } catch (encodingError) {
        console.error('Error preparing WebAuthn options:', encodingError);
        throw new Error('Lỗi định dạng dữ liệu xác thực');
      }

      // Tell the user what's happening
      toast('Vui lòng xác thực bằng sinh trắc học của thiết bị khi được yêu cầu');

      console.log('🔐 Activating device biometric authentication for account:', account.email);
      
      // Force a slight delay to ensure UI updates before the potentially blocking credential.get call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The native biometric prompt should appear after this call
      const credential = await navigator.credentials.get({
        publicKey: options
      });

      // If we got here, the user has successfully provided their fingerprint/biometric through the device's hardware
      console.log('✅ Native biometric authentication successful - processing server verification');

      // Step 3: Prepare credential for server verification
      let authResponse;
      try {
        authResponse = {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          response: {
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            userHandle: credential.response.userHandle
              ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
              : null
          },
          type: credential.type
        };
      } catch (encodingError) {
        console.error('Error encoding credential for server:', encodingError);
        throw new Error('Lỗi xử lý dữ liệu sinh trắc học');
      }

      // Step 4: Send response to server for verification
      let verifyResponse;
      try {
        // Get the API base URL from environment or use a fallback
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        
        verifyResponse = await axios.post(`${API_BASE_URL}/passkeys/auth/verify`, {
          email: account.email,
          response: authResponse
        });
        
        console.log('Server verification response:', verifyResponse.data);

        if (!verifyResponse.data.success) {
          throw new Error(verifyResponse.data.message || 'Xác thực không thành công');
        }
      } catch (apiError) {
        console.error('Error during server verification:', apiError);
        throw new Error(`Lỗi xác thực với máy chủ: ${apiError.message}`);
      }

      // Authentication successful - reset attempts
      setBiometricAttempts(0);

      // Handle successful login
      const { user, tokens } = verifyResponse.data;
      
      // Build full user object with token
      const userWithToken = { 
        ...user, 
        token: tokens.accessToken,
        // Ensure these critical fields are available for the app's authentication system
        UserID: user.id,
        username: user.username,
        role: user.role || 'STUDENT',
        // Preserve account storage information
        hasStoredPassword: account.hasStoredPassword,
        storedPassword: account.storedPassword
      };
      
      console.log('Constructed user object for login:', userWithToken);
      
      // Store tokens in localStorage directly for extra safety
      localStorage.setItem('token', tokens.accessToken);
      localStorage.setItem('authToken', tokens.accessToken);
      
      // Handle successful login via passkey
      handleLoginSuccess(userWithToken);
      
      toast.success('Đăng nhập bằng sinh trắc học thành công!');
      
      // Track this email as passkey-enabled for future reference
      const storedPasskeyAccounts = JSON.parse(localStorage.getItem('passkeyEnabledAccounts') || '[]');
      const updatedPasskeyAccounts = [...storedPasskeyAccounts, account.email];
      localStorage.setItem('passkeyEnabledAccounts', JSON.stringify([...new Set(updatedPasskeyAccounts)]));
      addToPasskeyAccounts(account.email);
      
    } catch (error) {
      console.error('❌ Passkey authentication error for account:', error);
      
      // Increment failed attempts
      const newAttempts = biometricAttempts + 1;
      setBiometricAttempts(newAttempts);
      
      // Check if max attempts reached
      if (newAttempts >= maxBiometricAttempts) {
        setSelectedAccountError('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
        toast.error('Quá nhiều lần thử không thành công. Vui lòng sử dụng mật khẩu.');
      } else {
        // Provide more helpful error messages based on common WebAuthn errors
        let errorMessage = `Xác thực sinh trắc học thất bại (lần thử ${newAttempts}/${maxBiometricAttempts}).`;
        
        if (error.name === 'NotAllowedError') {
          errorMessage += ' Người dùng từ chối xác thực hoặc không có sinh trắc học được đăng ký.';
        } else if (error.name === 'SecurityError') {
          errorMessage += ' Lỗi bảo mật: yêu cầu xác thực phải đến từ nguồn an toàn (HTTPS).';
        } else if (error.name === 'AbortError') {
          errorMessage += ' Xác thực bị hủy.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage += ' Phương thức xác thực không được hỗ trợ.';
        } else {
          errorMessage += ` ${error.message || ''}`;
        }
        
        setSelectedAccountError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setPasskeyLoading(false);
      
      // Remove the timeout for hiding the prompt
      if (biometricTimeoutRef.current) {
        clearTimeout(biometricTimeoutRef.current);
        biometricTimeoutRef.current = null;
      }
    }
  };

  // Function to check if an account has passkey registered
  const checkAccountPasskeyStatus = async (email) => {
    try {
      // First check localStorage for known passkey accounts
      const storedPasskeyAccounts = JSON.parse(localStorage.getItem('passkeyEnabledAccounts') || '[]');
      if (storedPasskeyAccounts.includes(email)) {
        return true;
      }
      
      // Then try to check with server (if available)
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        const response = await axios.post(`${API_BASE_URL}/passkeys/check-registration`, {
          email
        });
        
        // If server confirms passkey, store it locally for future reference
        if (response.data.hasPasskey) {
          const updatedAccounts = [...storedPasskeyAccounts, email];
          localStorage.setItem('passkeyEnabledAccounts', JSON.stringify([...new Set(updatedAccounts)]));
        }
        
        return response.data.hasPasskey || false;
      } catch (serverError) {
        // If server check fails, fall back to localStorage only
        console.log(`Server check failed for ${email}, using localStorage:`, serverError.message);
        return false;
      }
    } catch (error) {
      console.log(`No passkey found for ${email}:`, error.message);
      return false;
    }
  };

  // Check passkey status for all previous accounts
  useEffect(() => {
    const checkAllAccountsPasskey = async () => {
      if (previousAccounts.length > 0) {
        const passkeyChecks = await Promise.all(
          previousAccounts.map(async (account) => {
            const hasPasskey = await checkAccountPasskeyStatus(account.email);
            return { email: account.email, hasPasskey };
          })
        );
        
        const emailsWithPasskey = new Set(
          passkeyChecks.filter(check => check.hasPasskey).map(check => check.email)
        );
        setAccountsWithPasskey(emailsWithPasskey);
      }
    };

    checkAllAccountsPasskey();
  }, [previousAccounts]);

  // Handle Google OAuth redirect response với ID Token
  useEffect(() => {
    console.log('🔍 [FRONTEND] Checking for OAuth response with ID token...');
    
    // Check if there's a hash fragment in the URL (from Google OAuth redirect với id_token)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Log for debugging
    console.log('📋 [FRONTEND] Current URL details:', { 
      hash: hash || 'none', 
      search: searchParams.toString() || 'none',
      fullURL: window.location.href
    });
    
    if (hash) {
      console.log('✅ [FRONTEND] OAuth hash fragment detected, processing for ID token...');
      try {
        const params = new URLSearchParams(hash.substring(1)); // Remove #
        const idToken = params.get('id_token');
        const error = params.get('error');

        console.log('🔑 [FRONTEND] OAuth parameters found:', {
          hasIdToken: !!idToken,
          hasError: !!error,
          idTokenLength: idToken?.length
        });

        if (error) {
          console.error('❌ [FRONTEND] OAuth error from Google:', error);
          toast.error(`Google login failed: ${error}`);
          return;
        }

        if (idToken) {
          console.log('🚀 [FRONTEND] Processing ID token login...');
          console.log('📨 [FRONTEND] ID token received (first 50 chars):', idToken?.substring(0, 50) + '...');
          
          // Set loading state
          setLoading(true);
          
          // Send idToken to Spring backend
          handleGoogleIdToken(idToken);
          
          // Clean URL immediately to prevent re-processing on navigation
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('🧹 [FRONTEND] URL cleaned after OAuth processing');
        }
      } catch (error) {
        console.error('❌ [FRONTEND] Error processing OAuth response:', error);
        toast.error('Failed to process login response');
        setError('Failed to process login response');
        setLoading(false);
      }
    }
    
    // Also check for error in search params
    const error = searchParams.get('error');
    if (error) {
      console.error('❌ [FRONTEND] OAuth error in search params:', error);
      toast.error(`Google login failed: ${error}`);
    }
  }, []);

  // Helper function to add an email to passkey-enabled accounts
  const addToPasskeyAccounts = (email) => {
    setAccountsWithPasskey(prev => new Set([...prev, email]));
  };

  // Render the selected account password form if an account is selected
  if (selectedAccount) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Login Section - Keeping original width */}
        <div className="flex min-h-screen">
          {/* Left side - Password form for selected account */}
          <div className="flex-1 flex items-center justify-center bg-white">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md w-full px-6 py-12"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-center"
              >
                <div className="flex items-center justify-center space-x-2">
                  <img className="h-14 w-auto" src="/images/education-icon.svg" alt="Education Icon" />
                  <h1 className="text-4xl font-bold text-blue-600">Learning</h1>
                </div>
                
                <div className="mt-8 flex flex-col items-center">
                  <Avatar
                    src={selectedAccount.avatar || selectedAccount.profileImage || selectedAccount.Image}
                    name={selectedAccount.fullName || selectedAccount.FullName || selectedAccount.username || selectedAccount.email}
                    alt={selectedAccount.fullName || selectedAccount.FullName || selectedAccount.username || selectedAccount.email}
                    size="xl"
                    className="mb-4"
                  />
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedAccount.fullName || selectedAccount.FullName || selectedAccount.username || selectedAccount.email}
                  </h2>
                  <p className="mt-2 text-base text-gray-600">{selectedAccount.email}</p>
                </div>
              </motion.div>

              {selectedAccountError && (
                <p className="mt-6 text-sm text-red-600 text-center">{selectedAccountError}</p>
              )}

              <motion.form 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-6 space-y-6" 
                onSubmit={handleSelectedAccountLogin}
              >
                <div>
                  {/* Password field with toggle visibility */}
                  <div className="space-y-1">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 text-center">
                      Nhập mật khẩu của bạn
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={selectedAccountPassword}
                        onChange={(e) => setSelectedAccountPassword(e.target.value)}
                        className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={formData.remember}
                      onChange={(e) => setFormData({...formData, remember: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                      Ghi nhớ đăng nhập
                    </label>
                  </div>
                  <div className="text-sm">
                    <Link 
                      to="/forgot-password" 
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={selectedAccountLoading}
                      className={`flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        selectedAccountLoading 
                          ? 'bg-blue-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      }`}
                    >
                      {selectedAccountLoading ? (
                        'Đang đăng nhập...'
                      ) : 'Đăng nhập'}
                    </button>

                    {/* Fingerprint button for selected account */}
                    {isPasskeyAvailable && selectedAccount && accountsWithPasskey.has(selectedAccount.email) && (
                      <button
                        type="button"
                        onClick={() => loginWithPasskeyForAccount(selectedAccount)}
                        disabled={passkeyLoading || selectedAccountLoading}
                        className={`flex items-center justify-center p-3 transform transition-all duration-200 hover:scale-[1.1] active:scale-[0.9] ${
                          passkeyLoading || selectedAccountLoading
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:opacity-70 focus:outline-none'
                        } relative group`}
                        title={`Đăng nhập bằng sinh trắc học cho ${selectedAccount.fullName || selectedAccount.FullName || selectedAccount.username || selectedAccount.email}`}
                      >
                        {passkeyLoading ? (
                          <FingerPrintIcon className="h-7 w-7 text-gray-400 opacity-50" />
                        ) : (
                          <FingerPrintIcon className="h-7 w-7 text-gray-800" />
                        )}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleBackToAccounts}
                    className="flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-blue-600 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Quay lại danh sách tài khoản
                  </button>
                </div>
              </motion.form>
            </motion.div>
          </div>

          {/* Right side - Image (same as login page) */}
          <div className="hidden lg:block relative flex-1">
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80"
              alt="Learning background"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-indigo-700/80">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-center flex-1">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto text-center text-white px-4"
                  >
                    <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                      Learning
                    </h1>
                    <p className="text-xl sm:text-2xl mb-8">
                      Khám phá thế giới kiến thức không giới hạn
                    </p>
                    <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">10,000+</div>
                          <div className="text-sm text-white/80">Khóa học đa dạng</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">24/7</div>
                          <div className="text-sm text-white/80">Hỗ trợ mọi lúc</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">100%</div>
                          <div className="text-sm text-white/80">Cam kết chất lượng</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!showLoginForm && previousAccounts.length > 0) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Login Section - Keeping original width */}
        <div className="flex min-h-screen">
          {/* Left side - Account selection */}
          <div className="flex-1 flex items-center justify-center bg-white">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md w-full px-6 py-12"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-center"
              >
                <div className="flex items-center justify-center space-x-2">
                  <img className="h-14 w-auto" src="/images/education-icon.svg" alt="Education Icon" />
                  <h1 className="text-4xl font-bold text-blue-600">Learning</h1>
                </div>
                <h2 className="mt-8 text-3xl font-extrabold text-gray-900">
                  Chọn tài khoản
                </h2>
                <p className="mt-3 text-base text-gray-600">
                  Tiếp tục với tài khoản đã đăng nhập trước đó
                </p>
              </motion.div>

              <div className="mt-8 space-y-4">
                {previousAccounts.filter(account => account && account.email).map(account => (
                  <motion.div
                    key={account.email}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
                  >
                    <div className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors duration-200">
                      <button
                        onClick={() => handleAccountClick(account)}
                        className="flex items-center space-x-4 flex-1"
                      >
                        <Avatar
                          src={account.avatar || account.profileImage || account.Image}
                          name={account.fullName || account.FullName || account.username || account.email}
                          alt={account.fullName || account.FullName || account.username || account.email}
                          size="large"
                        />
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-800">
                            {account.fullName || account.FullName || account.username || account.email}
                          </span>
                          {(account.fullName || account.FullName) && (
                            <span className="text-sm text-gray-500">{account.email}</span>
                          )}
                        </div>
                      </button>
                      
                      {/* Fingerprint button for each account */}
                      {isPasskeyAvailable && accountsWithPasskey.has(account.email) && (
                        <button
                          type="button"
                          onClick={() => loginWithPasskeyForAccount(account)}
                          disabled={passkeyLoading}
                          className={`flex items-center justify-center p-2 transform transition-all duration-200 hover:scale-[1.1] active:scale-[0.9] ${
                            passkeyLoading
                              ? 'cursor-not-allowed opacity-50'
                              : 'hover:opacity-70 focus:outline-none'
                          } relative group`}
                          title={`Đăng nhập bằng sinh trắc học cho ${account.fullName || account.FullName || account.username || account.email}`}
                        >
                          {passkeyLoading ? (
                            <FingerPrintIcon className="h-6 w-6 text-gray-400 opacity-50" />
                          ) : (
                            <FingerPrintIcon className="h-6 w-6 text-gray-800" />
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowLoginForm(true)}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-blue-600 bg-white hover:bg-gray-50 transition-colors"
        >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
          Sử dụng tài khoản khác
        </button>

                <div className="mt-6 text-center">
                  <span className="text-sm text-gray-600">
                    Chưa có tài khoản?{' '}
                    <Link 
                      to="/register" 
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Đăng ký ngay
                    </Link>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right side - Image (keeping the same as login form) */}
          <div className="hidden lg:block relative flex-1">
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80"
              alt="Learning background"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-indigo-700/80">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-center flex-1">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto text-center text-white px-4"
                  >
                    <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                      Learning
                    </h1>
                    <p className="text-xl sm:text-2xl mb-8">
                      Khám phá thế giới kiến thức không giới hạn
                    </p>
                    <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">10,000+</div>
                          <div className="text-sm text-white/80">Khóa học đa dạng</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">24/7</div>
                          <div className="text-sm text-white/80">Hỗ trợ mọi lúc</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-left">
                          <div className="font-semibold text-lg">100%</div>
                          <div className="text-sm text-white/80">Cam kết chất lượng</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Us Section */}
        <About />
      </div>
    );
  }

  // Show full-page loading during initial login
  if (loading && !twoFaStage) {
    return <Loading message="Đang đăng nhập..." size="large" />;
  }
  // Show success loading with delay
  if (successLoading) {
    return <Loading message="Đăng nhập thành công! Đang chuyển hướng..." variant="success" size="large" />;
  }
  // Show loading for passkey authentication
  if (passkeyLoading) {
    return <Loading message="Đang xác thực sinh trắc học..." size="large" />;
  }
  // Show loading for 2FA verification
  if (twoFaLoading) {
    return <Loading message="Đang xác thực mã 2FA..." size="large" />;
  }
  // Show loading for account selection
  if (selectedAccountLoading) {
    return <Loading message="Đang xử lý tài khoản..." size="large" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Login Section - Keeping original width */}
      <div className="flex min-h-screen">
        {/* Left side - Login form */}
        <div className="flex-1 flex items-center justify-center bg-white">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full px-6 py-12"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center"
            >
              <div className="flex items-center justify-center space-x-2">
                <img
                  className="h-14 w-auto"
                  src="/images/education-icon.svg"
                  alt="Education Icon"
                />
                <h1 className="text-4xl font-bold text-blue-600">Learning</h1>
              </div>
              <h2 className="mt-8 text-3xl font-extrabold text-gray-900">
                Chào mừng trở lại!
              </h2>
              <p className="mt-3 text-base text-gray-600">
                Đăng nhập để tiếp tục hành trình học tập của bạn
              </p>
            </motion.div>

            {redirectMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md"
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">{redirectMessage}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="mt-6 text-sm text-red-600 text-center">{error}</p>
            )}

            {twoFaError && (
              <p className="mt-6 text-sm text-red-600 text-center">{twoFaError}</p>
            )}

            {twoFaStage ? (
              <div className="mt-8">
                <label className="block text-sm font-semibold text-gray-700 text-center">Mã xác thực 2FA</label>
                <p className="text-sm text-gray-600 text-center mt-2">
                  Vui lòng nhập mã xác thực từ ứng dụng của bạn
                </p>
                
                <div className="mt-4 flex justify-center space-x-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <input
                      key={idx}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={twoFaCode[idx] || ''}
                      onChange={(e) => handleTwoFaInput(e, idx)}
                      onKeyDown={(e) => handleTwoFaKeyDown(e, idx)}
                      ref={(el) => (inputsRef.current[idx] = el)}
                      disabled={twoFaLoading}
                      className={`w-10 h-10 text-center border ${twoFaError ? 'border-red-300' : 'border-gray-300'} rounded focus:outline-none focus:ring-2 ${twoFaError ? 'focus:ring-red-500' : 'focus:ring-blue-500'} transition-all duration-200`}
                    />
                  ))}
                </div>
                
                {twoFaError && (
                  <div className="mt-3 flex items-center justify-center text-red-600">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                    <p className="text-sm">{twoFaError}</p>
                  </div>
                )}
                
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setTwoFaStage(false)}
                    disabled={twoFaLoading}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              </div>
            ) : (
              <motion.form 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-8 space-y-6" 
                onSubmit={handleSubmit}
              >
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Email
                      </label>
                    </div>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="your@email.com"
                        ref={emailInputRef}
                      />
                    </div>
                  </div>

                  <div>
                    {/* Password field with toggle visibility */}
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                          Mật khẩu
                        </label>
                      </div>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <LockClosedIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          ) : (
                            <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={formData.remember}
                      onChange={(e) => setFormData({...formData, remember: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                      Ghi nhớ đăng nhập
                    </label>
                  </div>
                  <div className="text-sm">
                    <Link 
                      to="/forgot-password" 
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex space-x-4">
                    {/* Main login button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex-1 flex justify-center items-center py-3 px-4 border border-black rounded-lg shadow-sm text-base font-medium text-white transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        loading 
                          ? 'bg-blue-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      }`}
                    >
                      {loading ? (
                        'Đang đăng nhập...'
                      ) : 'Đăng nhập'}
                    </button>
                    
                    {/* Fingerprint button - as a separate button */}
                    {isPasskeyAvailable && (
                      <button
                        type="button"
                        onClick={loginWithPasskey}
                        disabled={passkeyLoading || !formData.email || loading}
                        className={`flex items-center justify-center p-3 transform transition-all duration-200 hover:scale-[1.1] active:scale-[0.9] ${
                          passkeyLoading || !formData.email || loading
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:opacity-70 focus:outline-none'
                        } relative group`}
                        title={!formData.email ? "Vui lòng nhập email trước khi sử dụng đăng nhập sinh trắc học" : "Đăng nhập bằng sinh trắc học"}
                      >
                        {!formData.email && (
                          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Nhập email trước
                          </div>
                        )}
                        {passkeyLoading ? (
                          <FingerPrintIcon className="h-7 w-7 text-gray-400 opacity-50" />
                        ) : (
                          <FingerPrintIcon className="h-7 w-7 text-gray-800" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Hoặc đăng nhập với</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  
                  {/* Google */}
                  {/* Google Login Button - FIXED VERSION */}
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🎯 [FRONTEND] Google login button clicked - ID Token Flow');
                      
                      // Get configuration from environment or use defaults
                      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '687543650693-istlhoe28vq9adl28v5lc9ojkhgo47mj.apps.googleusercontent.com';
                      
                      // Use the current origin as redirect URI
                      const redirectUri = encodeURIComponent('http://campuslearning.site/oauth2/callback/google');
                      
                      // QUAN TRỌNG: Dùng 'id_token' để nhận trực tiếp ID token
                      const responseType = 'id_token';
                      
                      // Request both profile information and email
                      const scope = encodeURIComponent(window.location.origin);
                      
                      // Generate a random nonce for security
                      const nonce = Math.random().toString(36).substring(2);
                      
                      console.log('🔐 [FRONTEND] Initiating Google authentication for ID token:', {
                        clientId: clientId.substring(0, 10) + '...',
                        redirectUri: decodeURIComponent(redirectUri),
                        currentOrigin: window.location.origin,
                        currentPathname: window.location.pathname
                      });
                      
                      // Construct the auth URL with all parameters
                      const googleAuthUrl = 
                        `https://accounts.google.com/o/oauth2/v2/auth?` +
                        `client_id=${clientId}` +
                        `&redirect_uri=${redirectUri}` +
                        `&response_type=${responseType}` +
                        `&scope=${scope}` +
                        `&nonce=${nonce}` +
                        `&prompt=select_account`;  // Force account selection
                      
                      console.log('🔄 [FRONTEND] Redirecting to Google OAuth for ID token');
                      
                      // Redirect to Google auth
                      window.location.href = googleAuthUrl;
                    }}
                    className="inline-flex justify-center items-center py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/768px-Google_%22G%22_logo.svg.png" 
                      alt="Google"
                      className="h-5 w-5"
                    />
                  </button>
                  {/* GitHub */}
                  <button
                    type="button"
                    className="inline-flex justify-center items-center py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="11" fill="white" />
                      <path d="M12,2 C6.48,2 2,6.48 2,12 C2,16.42 5.1,20.08 9.28,21.34 C9.78,21.44 9.98,21.14 9.98,20.88 C9.98,20.64 9.97,20.02 9.97,19.28 C7,19.82 6.35,18.14 6.15,17.6 C6.04,17.34 5.55,16.5 5.1,16.26 C4.73,16.06 4.23,15.52 5.09,15.51 C5.9,15.5 6.5,16.19 6.7,16.46 C7.7,17.9 9.28,17.63 10.02,17.37 C10.12,16.73 10.42,16.3 10.75,16.06 C8.35,15.82 5.85,15 5.85,11.14 C5.85,10.08 6.3,9.2 6.72,8.54 C6.61,8.29 6.21,7.28 6.82,5.97 C6.82,5.97 7.76,5.71 9.98,7.28 C10.63,7.06 11.33,6.95 12.03,6.95 C12.73,6.95 13.43,7.06 14.08,7.28 C16.3,5.7 17.24,5.97 17.24,5.97 C17.85,7.28 17.45,8.29 17.34,8.54 C17.77,9.2 18.21,10.07 18.21,11.14 C18.21,15.01 15.7,15.82 13.3,16.06 C13.7,16.36 14.05,16.95 14.05,17.85 C14.05,19.15 14.04,20.54 14.04,20.88 C14.04,21.14 14.24,21.45 14.74,21.34 C18.92,20.08 22.02,16.41 22.02,12 C22.02,6.48 17.54,2 12.02,2 L12,2 Z" fill="#24292F" />
                    </svg>
                  </button>
                  
                  {/* Twitter/X */}
                  <button
                    type="button"
                    className="inline-flex justify-center items-center py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="11" fill="white" />
                      <path d="M18.5,6.5 L15,10.5 L19,17.5 L13,17.5 L11,15 L8.5,17.5 L5,17.5 L10,10.5 L6,4.5 L11.5,4.5 L13.5,7 L16,4.5 L18.5,6.5 Z" fill="black" />
                    </svg>
                  </button>
                  
                  {/* OTP login */}
                  <button
                    type="button"
                    onClick={handleLoginOtp}
                    disabled={loading}
                    className="inline-flex justify-center items-center py-2.5 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                    title="Đăng nhập bằng OTP"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="11" fill="white" />
                      <path d="M4,8 L20,8 C21.1,8 22,8.9 22,10 L22,18 C22,19.1 21.1,20 20,20 L4,20 C2.9,20 2,19.1 2,18 L2,10 C2,8.9 2.9,8 4,8 Z" fill="none" stroke="#6B7280" strokeWidth="1.5" />
                      <path d="M22,10 L12,15 L2,10" fill="none" stroke="#6B7280" strokeWidth="1.5" />
                    </svg>
                  </button>
                </div>

                <div className="text-center mt-6">
                  <span className="text-sm text-gray-600">
                    Chưa có tài khoản?{' '}
                    <Link 
                      to="/register" 
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Đăng ký ngay
                    </Link>
                  </span>
                </div>
                
                {previousAccounts.length > 0 && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Quay lại danh sách tài khoản
                    </button>
                  </div>
                )}
              </motion.form>
            )}

            {/* Display a message if fingerprint login is not available */}
            {!isPasskeyAvailable && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start space-x-3">
                  <ExclamationCircleIcon className="h-6 w-6 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900">Thiết bị không hỗ trợ</h4>
                    <p className="text-sm mt-1 text-gray-600">
                      Trình duyệt hoặc thiết bị của bạn không hỗ trợ xác thực sinh trắc học.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </div>

        {/* Right side - Image */}
        <div className="hidden lg:block relative flex-1">
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80"
            alt="Learning background"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-indigo-700/80">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-center flex-1">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-2xl mx-auto text-center text-white px-4"
                >
                  <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                    Learning
                  </h1>
                  <p className="text-xl sm:text-2xl mb-8">
                    Khám phá thế giới kiến thức không giới hạn
                  </p>
                  <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
                    <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <div className="text-left">
                        <div className="font-semibold text-lg">10,000+</div>
                        <div className="text-sm text-white/80">Khóa học đa dạng</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <div className="text-left">
                        <div className="font-semibold text-lg">24/7</div>
                        <div className="text-sm text-white/80">Hỗ trợ mọi lúc</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-lg p-4">
                      <div className="text-left">
                        <div className="font-semibold text-lg">100%</div>
                        <div className="text-sm text-white/80">Cam kết chất lượng</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Us Section */}
      <About />
    </div>
  );
};

export default Login; 