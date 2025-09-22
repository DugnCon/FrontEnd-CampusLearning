/*-----------------------------------------------------------------
* File: apiSlice.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the teacher application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../store/slices/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5003/api/v1/',
  prepareHeaders: (headers, { getState }) => {
    const token = localStorage.getItem('teacherToken') || getState().auth.token;
    
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    
    return headers;
  },
  credentials: 'include',
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result?.error?.status === 401) {
    console.log('Authentication error:', result.error);
    
    api.dispatch(logout());
    
    window.location.href = '/login';
  }
  
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Course', 'Student', 'Assignment', 'Notification'],
  endpoints: () => ({}),
}); 
