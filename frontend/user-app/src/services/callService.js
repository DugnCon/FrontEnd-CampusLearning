/*-----------------------------------------------------------------
* File: callService.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Service for handling call-related API requests
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Creates an axios instance with custom error handling
 */
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR'
      });
    }

    // Handle specific HTTP status codes
    switch (error.response.status) {
      case 401:
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        window.location.href = '/login';
        break;
      case 404:
        // Not found - return friendly message
        return Promise.reject({
          message: 'Call service not available',
          code: 'SERVICE_UNAVAILABLE',
          status: 404
        });
      case 500:
        return Promise.reject({
          message: 'Server error. Please try again later.',
          code: 'SERVER_ERROR'
        });
      default:
        return Promise.reject(error.response.data || { 
          message: 'An unexpected error occurred' 
        });
    }
  }
);

const callService = {
  /**
   * Initiate a call to another user
   * @param {string} receiverId - User ID of the receiver
   * @param {string} type - Type of call ('audio' or 'video')
   * @returns {Promise} - Promise with call data
   */
  initiateCall: async (receiverId, type = 'video') => {
    try {
      const response = await api.post('/calls/initiate', {
        receiverId,
        type
      });
      
      return response.data;
    } catch (error) {
      console.error('Call initiation error:', error);
      
      // Enhanced error messages
      const enhancedError = {
        ...error,
        userMessage: error.message === 'Network error. Please check your connection.' 
          ? 'Cannot connect to call service. Please check your internet connection.'
          : `Failed to start call: ${error.message}`
      };
      
      throw enhancedError;
    }
  },

  /**
   * Answer an incoming call
   * @param {string} callId - Call ID
   * @returns {Promise} - Promise with call data
   */
  answerCall: async (callId) => {
    try {
      const response = await api.post('/calls/answer', { callId });
      return response.data;
    } catch (error) {
      console.error('Call answer error:', error);
      
      const enhancedError = {
        ...error,
        userMessage: `Failed to answer call: ${error.message}`
      };
      
      throw enhancedError;
    }
  },

  /**
   * End an active call
   * @param {string} callId - Call ID
   * @returns {Promise} - Promise with call result
   */
  endCall: async (callId) => {
    try {
      const response = await api.post('/calls/end', { callId });
      return response.data;
    } catch (error) {
      console.error('Call end error:', error);
      
      // If it's a 404, the call might already be ended on the server
      if (error.status === 404) {
        return { success: true, message: 'Call ended' };
      }
      
      const enhancedError = {
        ...error,
        userMessage: `Failed to end call: ${error.message}`
      };
      
      throw enhancedError;
    }
  },

  /**
   * Reject an incoming call
   * @param {string} callId - Call ID
   * @returns {Promise} - Promise with call result
   */
  rejectCall: async (callId) => {
    try {
      const response = await api.post('/calls/reject', { callId });
      return response.data;
    } catch (error) {
      console.error('Call rejection error:', error);
      
      const enhancedError = {
        ...error,
        userMessage: `Failed to reject call: ${error.message}`
      };
      
      throw enhancedError;
    }
  },

  /**
   * Get call history
   * @param {number} limit - Number of records to fetch
   * @param {number} offset - Offset for pagination
   * @returns {Promise} - Promise with call history
   */
  getCallHistory: async (limit = 20, offset = 0) => {
    try {
      const response = await api.get('/calls/history', {
        params: { limit, offset }
      });
      
      return response.data;
    } catch (error) {
      console.error('Call history error:', error);
      
      // Return empty data for 404 instead of throwing
      if (error.status === 404) {
        return { calls: [], total: 0, hasMore: false };
      }
      
      const enhancedError = {
        ...error,
        userMessage: `Failed to load call history: ${error.message}`
      };
      
      throw enhancedError;
    }
  },

  /**
   * Check for active call
   * @returns {Promise} - Promise with active call data if exists
   */
  getActiveCall: async () => {
    try {
      const response = await api.get('/calls/active');
      return response.data;
    } catch (error) {
      console.error('Active call check error:', error);
      
      // Return default response for 404
      if (error.status === 404) {
        return { hasActiveCall: false, call: null };
      }
      
      throw error;
    }
  },
  
  /**
   * Get call details by ID
   * @param {string} callId - Call ID
   * @returns {Promise} - Promise with call details
   */
  getCallDetails: async (callId) => {
    try {
      const response = await api.get(`/calls/${callId}`);
      return response.data;
    } catch (error) {
      console.error('Call details error:', error);
      throw error;
    }
  },

  /**
   * Check if call service is available
   * @returns {Promise<boolean>} - True if service is available
   */
  isServiceAvailable: async () => {
    try {
      // Simple HEAD request to check if endpoint exists
      await api.head('/calls/health');
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get available audio output devices
   * @returns {Promise<MediaDeviceInfo[]>} - List of audio output devices
   */
  getAudioOutputDevices: async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audiooutput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  },

  /**
   * Set audio output device
   * @param {string} deviceId - Device ID
   * @returns {Promise<boolean>} - Success status
   */
  setAudioOutput: async (deviceId) => {
    try {
      // This would typically be handled in the UI layer
      // since it involves HTMLMediaElement.setSinkId()
      return true;
    } catch (error) {
      console.error('Error setting audio output:', error);
      return false;
    }
  }
};

export default callService;