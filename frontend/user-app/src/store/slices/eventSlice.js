/*-----------------------------------------------------------------
* File: eventSlice.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { eventServices } from '@/services/api';
import { getEventDetail } from '@/services/eventServices';

// === HÀM CHUẨN HÓA TÊN TRƯỜNG ===
const normalizeEvent = (event) => {
  if (!event) return null;

  return {
    EventID: event.eventID ?? event.EventID,
    Title: event.title ?? event.Title,
    Description: event.description ?? event.Description,
    Category: event.category ?? event.Category,
    EventDate: event.eventDate ?? event.EventDate,
    EventTime: event.eventTime ?? event.EventTime ?? '00:00:00',
    Location: event.location ?? event.Location,
    ImageUrl: event.imageUrl ?? event.ImageUrl,
    Organizer: event.organizer ?? event.Organizer,
    Difficulty: event.difficulty ?? event.Difficulty,
    Status: event.status ?? event.Status,
    Price: parseFloat(event.price ?? event.Price) || 0,
    MaxAttendees: parseInt(event.maxAttendees ?? event.MaxAttendees) || 0,
    CurrentAttendees: parseInt(event.currentAttendees ?? event.CurrentAttendees) || 0,
    // Các trường khác nếu cần
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    deletedAt: event.deletedAt,
  };
};

export const fetchUpcomingEvents = createAsyncThunk(
  'events/fetchUpcoming',
  async (_, { rejectWithValue }) => {
    try {
      const response = await eventServices.getUpcomingEvents();
      const rawEvents = Array.isArray(response.data) ? response.data : [];
      return rawEvents.map(normalizeEvent).filter(Boolean);
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Không thể tải sự kiện sắp diễn ra' });
    }
  }
);

export const fetchEvents = createAsyncThunk(
  'events/fetchAll',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await eventServices.getAllEvents(filters);
      console.log('Events API Response:', response);

      if (!response.data) {
        throw new Error('No data received from API');
      }

      // Xử lý cả mảng trực tiếp hoặc { event: [...] }
      let rawEvents = [];
      if (Array.isArray(response.data)) {
        rawEvents = response.data;
      } else if (response.data.event && Array.isArray(response.data.event)) {
        rawEvents = response.data.event;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        rawEvents = response.data.data;
      } else {
        console.warn('Unexpected API response format:', response.data);
        rawEvents = [];
      }

      // Chuẩn hóa toàn bộ sự kiện
      return rawEvents.map(normalizeEvent).filter(Boolean);

    } catch (error) {
      console.error('Fetch events error:', error);
      return rejectWithValue(
        error.response?.data || { 
          message: 'Không thể tải sự kiện',
          error: error.message 
        }
      );
    }
  }
);

export const registerEvent = createAsyncThunk(
  'events/registerEvent',
  async ({ eventId, userData = {} }, { rejectWithValue }) => {
    try {
      console.log('Attempting to register for event:', eventId);
      const response = await eventServices.registerForEvent(eventId, userData);
      console.log('Registration successful:', response);
      return { 
        success: true, 
        message: 'Đăng ký tham gia sự kiện thành công!', 
        data: response.data 
      };
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = 
        error.response?.data?.message || 
        error.message || 
        'Đăng ký thất bại. Vui lòng thử lại sau.';
      
      return rejectWithValue({ 
        message: errorMessage,
        error: error.toString()
      });
    }
  }
);

export const fetchEventDetail = createAsyncThunk(
  'events/fetchEventDetail',
  async (eventId, { rejectWithValue }) => {
    try {
      const response = await getEventDetail(eventId);
      
      if (!response.data) {
        throw new Error('Không tìm thấy thông tin sự kiện');
      }

      // Chuẩn hóa chi tiết sự kiện
      const normalizedEvent = normalizeEvent(response.data);

      return {
        ...normalizedEvent,
        schedule: Array.isArray(response.data.schedule) ? response.data.schedule : [],
        prizes: Array.isArray(response.data.prizes) ? response.data.prizes : [],
        languages: Array.isArray(response.data.languages) ? response.data.languages : [],
        technologies: Array.isArray(response.data.technologies) ? response.data.technologies : []
      };
    } catch (error) {
      if (error.response?.status === 401) {
        return rejectWithValue({ 
          message: 'Vui lòng đăng nhập để xem chi tiết',
          isAuthError: true 
        });
      }
      return rejectWithValue({ 
        message: 'Không thể tải thông tin sự kiện',
        error: error.message 
      });
    }
  }
);

export const cancelRegistration = createAsyncThunk(
  'events/cancelRegistration',
  async (eventId, { rejectWithValue }) => {
    try {
      console.log('Attempting to cancel registration for event:', eventId);
      const response = await eventServices.cancelEventRegistration(eventId);
      console.log('Cancel registration successful:', response);
      return { success: true, message: 'Hủy đăng ký sự kiện thành công!', data: response.data };
    } catch (error) {
      console.error('Cancel registration failed:', error);
      const errorMessage = 
        error.message || 
        error.response?.data?.message || 
        'Hủy đăng ký thất bại. Vui lòng thử lại sau.';
      
      return rejectWithValue({ 
        message: errorMessage,
        error: error.toString()
      });
    }
  }
);

export const checkRegistrationStatus = createAsyncThunk(
  'events/checkRegistrationStatus',
  async (eventId, { rejectWithValue }) => {
    try {
      console.log('Checking registration status for event:', eventId);
      const response = await eventServices.checkEventRegistration(eventId);
      console.log('Check registration status successful:', response);
      
      const data = response.data || response;
      
      return {
        isRegistered: data.isRegistered || false,
        registrationInfo: data.registrationInfo || null
      };
    } catch (error) {
      console.error('Check registration status failed:', error);
      return { isRegistered: false, registrationInfo: null };
    }
  }
);

const initialState = {
  events: [],
  upcomingEvents: [],
  loading: false,
  error: null,
  filters: {
    category: 'all',
    difficulty: 'all',
    status: 'upcoming'
  },
  currentEvent: null,
  isRegistered: false,
  registrationInfo: null,
  registrationLoading: false
};

const eventSlice = createSlice({
  name: 'event',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentEvent: (state) => {
      state.currentEvent = null;
      state.isRegistered = false;
      state.registrationInfo = null;
    },
    setRegistrationStatus: (state, action) => {
      state.isRegistered = action.payload.isRegistered;
      state.registrationInfo = action.payload.registrationInfo;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchEvents
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload || [];
        state.error = null;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.events = [];
        state.error = action.payload?.message || 'Lỗi khi tải sự kiện';
      })

      // fetchUpcomingEvents
      .addCase(fetchUpcomingEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUpcomingEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.upcomingEvents = action.payload || [];
      })
      .addCase(fetchUpcomingEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Lỗi khi tải sự kiện sắp diễn ra';
      })

      // fetchEventDetail
      .addCase(fetchEventDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEventDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentEvent = action.payload;
        state.error = null;
      })
      .addCase(fetchEventDetail.rejected, (state, action) => {
        state.loading = false;
        state.currentEvent = null;
        state.error = action.payload?.message || 'Lỗi khi tải thông tin sự kiện';
      })

      // checkRegistrationStatus
      .addCase(checkRegistrationStatus.pending, (state) => {
        state.registrationLoading = true;
      })
      .addCase(checkRegistrationStatus.fulfilled, (state, action) => {
        state.registrationLoading = false;
        state.isRegistered = action.payload.isRegistered;
        state.registrationInfo = action.payload.registrationInfo;
      })
      .addCase(checkRegistrationStatus.rejected, (state) => {
        state.registrationLoading = false;
        state.isRegistered = false;
        state.registrationInfo = null;
      })

      // registerEvent & cancelRegistration
      .addCase(registerEvent.fulfilled, (state) => {
        state.isRegistered = true;
      })
      .addCase(cancelRegistration.fulfilled, (state) => {
        state.isRegistered = false;
        state.registrationInfo = null;
      });
  }
});

export const { setFilters, clearCurrentEvent, setRegistrationStatus } = eventSlice.actions;
export default eventSlice.reducer;