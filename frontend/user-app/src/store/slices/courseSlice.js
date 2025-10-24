/*-----------------------------------------------------------------
* File: courseSlice.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
-----------------------------------------------------------------*/
import courseApi from '@/api/courseApi';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const getCachedCourses = () => {
  const cached = localStorage.getItem('enrolledCourses');
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) return data;
    } catch (e) {
      console.warn('Failed to parse cached courses');
    }
  }
  return null;
};

const cacheCourses = (courses) => {
  try {
    localStorage.setItem('enrolledCourses', JSON.stringify({
      data: courses,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to cache courses');
  }
};

export const fetchEnrolledCourses = createAsyncThunk(
  'course/fetchEnrolledCourses',
  async (options = {}, { dispatch, rejectWithValue }) => {
    const { forceRefresh = false } = options;
    try {
      const cachedCourses = !forceRefresh && getCachedCourses();
      if (cachedCourses) {
        dispatch({ type: 'course/fetchEnrolledCourses/fulfilled', payload: cachedCourses });
        if (!forceRefresh) {
          setTimeout(() => dispatch(fetchEnrolledCourses({ forceRefresh: true })), 100);
          return cachedCourses;
        }
      }

      const response = await courseApi.getEnrolledCourses();
      if (response.data && response.data.success) {
        let courses = response.data.data.map(course => ({ ...course, enrolled: true }));

        const uniqueMap = new Map();
        courses.forEach(course => {
          const uniqueID = course.courseID || course.id;
          if (uniqueID && !uniqueMap.has(uniqueID)) uniqueMap.set(uniqueID, course);
        });
        courses = Array.from(uniqueMap.values());
        cacheCourses(courses);
        return courses;
      } else {
        return rejectWithValue(response.data?.message || 'Không thể tải khóa học đã đăng ký');
      }
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      return rejectWithValue(error.response?.data?.message || 'Đã xảy ra lỗi khi tải khóa học đã đăng ký');
    }
  }
);

export const preloadAllCourses = createAsyncThunk(
  'course/preloadAllCourses',
  async (_, { rejectWithValue }) => {
    try {
      const response = await courseApi.getAllCourses();
      if (response.data && response.data.success) {
        localStorage.setItem('allCourses', JSON.stringify({
          data: response.data.data,
          timestamp: Date.now()
        }));
        return response.data.data;
      } else {
        return rejectWithValue(response.data?.message || 'Không thể tải danh sách khóa học');
      }
    } catch (error) {
      console.error('Error preloading all courses:', error);
      return rejectWithValue(error.response?.data?.message || 'Đã xảy ra lỗi khi tải danh sách khóa học');
    }
  }
);

export const enrollFreeCourse = createAsyncThunk(
  'courses/enrollFreeCourse',
  async (courseId, { rejectWithValue }) => {
    try {
      const response = await courseApi.enrollFreeCourse(courseId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Không thể đăng ký khóa học' });
    }
  }
);

const initialState = {
  enrolledCourses: [],
  allCourses: [],
  loading: false,
  error: null,
  enrollmentSuccess: false,
  dataLoaded: false
};

const courseSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    clearCourses: (state) => {
      state.enrolledCourses = [];
    },
    resetEnrollmentStatus: (state) => {
      state.enrollmentSuccess = false;
    },
    addEnrolledCourse: (state, action) => {
      const normalizedCourse = {
        ...action.payload,
        CourseID: action.payload.courseID || action.payload.id || null,
        enrolled: true,
        CourseType: action.payload.CourseType || action.payload.courseType ||
          ((action.payload.Title || action.payload.title || '').toLowerCase().includes('it') ? 'it' : 'regular')
      };
      const courseExists = state.enrolledCourses.some(
        course => (course.CourseID === normalizedCourse.CourseID) || 
                  (course.id === normalizedCourse.CourseID) ||
                  (normalizedCourse.id && (course.CourseID === normalizedCourse.id || course.id === normalizedCourse.id))
      );
      if (!courseExists && normalizedCourse.CourseID) {
        state.enrolledCourses.push(normalizedCourse);
        const cachedCourses = getCachedCourses() || [];
        const notInCache = !cachedCourses.some(
          course => (course.CourseID === normalizedCourse.CourseID) || 
                    (course.id === normalizedCourse.CourseID) ||
                    (normalizedCourse.id && (course.CourseID === normalizedCourse.id || course.id === normalizedCourse.id))
        );
        if (notInCache) cacheCourses([...cachedCourses, normalizedCourse]);
      }
    },
    loadCachedAllCourses: (state) => {
      const cached = localStorage.getItem('allCourses');
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            state.allCourses = data;
            state.dataLoaded = true;
          }
        } catch (e) {
          console.warn('Failed to parse cached all courses');
        }
      }
    },
    // ✅ Thêm reducer resetCourses mới
    resetCourses: (state) => {
      state.enrolledCourses = [];
      state.allCourses = [];
      state.loading = false;
      state.error = null;
      state.enrollmentSuccess = false;
      state.dataLoaded = false;
      localStorage.removeItem('enrolledCourses');
      localStorage.removeItem('allCourses');
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEnrolledCourses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEnrolledCourses.fulfilled, (state, action) => {
        state.loading = false;
        state.enrolledCourses = action.payload;
      })
      .addCase(fetchEnrolledCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(preloadAllCourses.fulfilled, (state, action) => {
        state.allCourses = action.payload;
        state.dataLoaded = true;
      })
      .addCase(enrollFreeCourse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(enrollFreeCourse.fulfilled, (state, action) => {
        state.loading = false;
        state.enrollmentSuccess = true;
        if (action.payload && action.payload.course) {
          const newCourse = { ...action.payload.course, enrolled: true };
          const exists = state.enrolledCourses.some(
            course => (course.CourseID === newCourse.CourseID || course.CourseID === newCourse.id) ||
                      (course.id === newCourse.CourseID || course.id === newCourse.id)
          );
          if (!exists) {
            state.enrolledCourses.push(newCourse);
            const cachedCourses = getCachedCourses() || [];
            cacheCourses([...cachedCourses, newCourse]);
          }
        }
      })
      .addCase(enrollFreeCourse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Lỗi khi đăng ký khóa học';
      });
  }
});

export const { clearCourses, resetEnrollmentStatus, addEnrolledCourse, loadCachedAllCourses, resetCourses } = courseSlice.actions;
export default courseSlice.reducer;
