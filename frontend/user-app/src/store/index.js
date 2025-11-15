/*-----------------------------------------------------------------
* File: index.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24 → Updated: 2025-11-15 by Grok (fix cache bug)
* Description: Redux store with full reset support (RESET_APP)
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import courseReducer from './slices/courseSlice';
import eventReducer from './slices/eventSlice';
import notificationReducer from './slices/notificationSlice';
import postReducer from './slices/postSlice';
import rankingReducer from './slices/rankingSlice';
import aiChatReducer from './slices/aiChatSlice';
import chatReducer from './slices/chatSlice';
import reportReducer from './slices/reportSlice';
import userReducer from './slices/userSlice';
import examReducer from './slices/examSlice';

// === COMBINE ALL REDUCERS ===
const combinedReducer = combineReducers({
  auth: authReducer,
  course: courseReducer,
  event: eventReducer,
  notification: notificationReducer,
  post: postReducer,
  ranking: rankingReducer,
  aiChat: aiChatReducer,
  chat: chatReducer,
  report: reportReducer,
  user: userReducer,
  exam: examReducer,
});

// === ROOT REDUCER WITH RESET SUPPORT ===
const rootReducer = (state, action) => {
  // KHI CÓ ACTION RESET_APP → XÓA SẠCH TOÀN BỘ STATE
  if (action.type === 'RESET_APP') {
    // Reset về undefined → Redux sẽ khởi tạo lại initial state
    state = undefined;
  }
  return combinedReducer(state, action);
};

// === CONFIGURE STORE ===
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      ...(process.env.NODE_ENV === 'development' && {
        immutableCheck: { warnAfter: 300 },
        serializableCheck: { warnAfter: 300 },
      }),
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Log initial state
if (process.env.NODE_ENV === 'development') {
  console.log('Initial Redux State:', store.getState());
}

export default store;