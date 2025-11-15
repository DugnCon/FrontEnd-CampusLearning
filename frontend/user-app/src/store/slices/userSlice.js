/*-----------------------------------------------------------------
* File: userSlice.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Redux slice for user profile, settings, and account actions
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userServices } from '@/services/api';
import settingsServices from '@/api/settings';

// --- Async Thunks ---
export const getUserSettings = createAsyncThunk('user/getSettings', async (_, { rejectWithValue }) => {
  try {
    const response = await settingsServices.getUserSettings();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const getUserProfile = createAsyncThunk('user/getProfile', async (_, { rejectWithValue }) => {
  try {
    const response = await userServices.getUserProfile();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const updateUserSettings = createAsyncThunk('user/updateSettings', async (settings, { rejectWithValue }) => {
  try {
    const response = await settingsServices.updateSettings(settings);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const updateUserProfile = createAsyncThunk('user/updateProfile', async (profileData, { rejectWithValue }) => {
  try {
    const response = await userServices.updateProfile(profileData);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const uploadProfilePicture = createAsyncThunk('user/uploadProfilePicture', async (formData, { rejectWithValue }) => {
  try {
    const response = await settingsServices.uploadProfilePicture(formData);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data || { message: error.message });
  }
});

export const changePassword = createAsyncThunk(
  'user/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const response = await settingsServices.changePassword(currentPassword, newPassword);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const deleteAccount = createAsyncThunk(
  'user/deleteAccount',
  async ({ password, reason }, { rejectWithValue }) => {
    try {
      const response = await settingsServices.deleteAccount(password, reason);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// --- Initial State ---
const initialState = {
  settings: null,
  profileInfo: null,
  extendedProfile: null,
  loading: false,
  error: null,
  success: false,
  message: null,
  stateVersion: 0
};

// --- Slice ---
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUserState: (state) => {
      state.error = null;
      state.success = false;
      state.message = null;
      state.stateVersion++;
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get settings
      .addCase(getUserSettings.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getUserSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload.settings;
        state.profileInfo = action.payload.profileInfo;
        state.success = true;
        state.stateVersion++;
      })
      .addCase(getUserSettings.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể lấy cài đặt người dùng'; state.stateVersion++; })

      // Get profile
      .addCase(getUserProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.extendedProfile = action.payload.profile;
        if (!state.profileInfo && action.payload.profile) {
          state.profileInfo = {
            fullName: action.payload.profile.FullName,
            email: action.payload.profile.Email,
            username: action.payload.profile.Username,
            image: action.payload.profile.Image,
          };
        }
        state.success = true;
        state.stateVersion++;
      })
      .addCase(getUserProfile.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể lấy thông tin hồ sơ người dùng'; state.stateVersion++; })

      // Update settings
      .addCase(updateUserSettings.pending, (state) => { state.loading = true; state.error = null; state.success = false; })
      .addCase(updateUserSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload.settings;
        state.success = true;
        state.message = action.payload.message;
        state.stateVersion++;
      })
      .addCase(updateUserSettings.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể cập nhật cài đặt'; state.success = false; state.stateVersion++; })

      // Update profile
      .addCase(updateUserProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.profile) {
          state.extendedProfile = action.payload.profile;
          if (state.profileInfo) {
            state.profileInfo = { ...state.profileInfo, fullName: action.payload.profile.FullName, username: action.payload.profile.Username, image: action.payload.profile.Image };
          }
        }
        state.success = true;
        state.message = action.payload.message || 'Hồ sơ đã được cập nhật thành công';
        state.stateVersion++;
      })
      .addCase(updateUserProfile.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể cập nhật hồ sơ'; state.success = false; state.stateVersion++; })

      // Upload profile picture
      .addCase(uploadProfilePicture.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profileInfo) state.profileInfo.profileImage = action.payload.profileImage;
        state.success = true;
        state.message = action.payload.message;
        state.stateVersion++;
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể tải lên ảnh đại diện'; state.success = false; state.stateVersion++; })

      // Change password
      .addCase(changePassword.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(changePassword.fulfilled, (state, action) => { state.loading = false; state.success = true; state.message = action.payload.message; state.stateVersion++; })
      .addCase(changePassword.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể thay đổi mật khẩu'; state.success = false; state.stateVersion++; })

      // Delete account
      .addCase(deleteAccount.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteAccount.fulfilled, (state, action) => { state.loading = false; state.success = true; state.message = action.payload.message; state.stateVersion++; })
      .addCase(deleteAccount.rejected, (state, action) => { state.loading = false; state.error = action.payload?.message || 'Không thể xóa tài khoản'; state.success = false; state.stateVersion++; });
  }
});

export const { clearUserState, resetState } = userSlice.actions;
export default userSlice.reducer;
