import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationServices } from '../../services/api';

// Async thunk actions
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationServices.getAllNotifications();
      return response.data.notifications || [];
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Không thể tải thông báo');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationServices.getUnreadCount();
      return response.data.count;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Không thể tải số thông báo chưa đọc');
    }
  }
);

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    resetNotifications: () => initialState // ⭐ reset toàn bộ slice về trạng thái ban đầu
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = Array.isArray(action.payload) ? action.payload : [];
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.notifications = [];
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      });
  }
});

export const { clearNotifications, resetNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
