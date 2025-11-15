/*-----------------------------------------------------------------
* File: reportSlice.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: Redux slice for user reports
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import userApi from '../../api/config';

// --- Async Thunks ---
export const createReport = createAsyncThunk(
  'reports/createReport',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await userApi.post('/reports', reportData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const fetchUserReports = createAsyncThunk(
  'reports/fetchUserReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userApi.get('/reports/user');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// --- Initial State ---
const initialState = {
  reports: [],
  loading: false,
  error: null,
  success: false,
  stateVersion: 0
};

// --- Slice ---
const reportSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    updateReportStatus: (state, action) => {
      const { reportId, status } = action.payload;
      const report = state.reports.find(r => r.id === reportId);
      if (report) {
        report.status = status;
        state.stateVersion++;
      }
    },
    resetReports: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Create report
      .addCase(createReport.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.loading = false;
        state.reports.unshift(action.payload);
        state.success = true;
        state.stateVersion++;
      })
      .addCase(createReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Không thể tạo báo cáo';
        state.success = false;
        state.stateVersion++;
      })

      // Fetch user reports
      .addCase(fetchUserReports.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserReports.fulfilled, (state, action) => {
        state.loading = false;
        state.reports = Array.isArray(action.payload) ? action.payload : [];
        state.success = true;
        state.stateVersion++;
      })
      .addCase(fetchUserReports.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Không thể tải báo cáo';
        state.success = false;
        state.stateVersion++;
      });
  }
});

export const { updateReportStatus, resetReports } = reportSlice.actions;
export default reportSlice.reducer;
