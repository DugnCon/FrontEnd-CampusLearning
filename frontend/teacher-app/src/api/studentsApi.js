/*-----------------------------------------------------------------
* File: studentsApi.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the teacher application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import { apiSlice } from './apiSlice';

export const studentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query({
      query: () => 'students',
      providesTags: (result) =>
        result
          ? [
              ...result.students.map(({ UserID }) => ({ type: 'Student', id: UserID })),
              { type: 'Student', id: 'LIST' },
            ]
          : [{ type: 'Student', id: 'LIST' }],
    }),
    
    getStudentById: builder.query({
      query: (id) => `students/${id}`,
      providesTags: (result, error, id) => [{ type: 'Student', id }],
    }),
    
    searchStudents: builder.query({
      query: (query) => `students/search/${query}`,
      providesTags: [{ type: 'Student', id: 'LIST' }],
    }),
    
    sendNotification: builder.mutation({
      query: (data) => ({
        url: 'students/notify',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentByIdQuery,
  useSearchStudentsQuery,
  useSendNotificationMutation,
} = studentsApi; 
