import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

// Tạo instance riêng để tự động gắn token vào header
const axiosInstance = axios.create({
  baseURL: API_URL,
})

// Middleware: tự động thêm Authorization header nếu có token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const postService = {
  // 🟢 Tạo bài viết (có upload file)
  createPost: async (postData) => {
    const response = await axiosInstance.post('/posts', postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getPosts: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams({ page, limit, ...filters })
    const response = await axiosInstance.get(`/posts?${params}`)
    return response.data
  },

  getPost: async (postId) => {
    const response = await axiosInstance.get(`/posts/${postId}`)
    return response.data
  },

  getUserPosts: async (userId, page = 1, limit = 10) => {
    const params = new URLSearchParams({ page, limit })
    const response = await axiosInstance.get(`/posts/user/${userId}?${params}`)
    return response.data
  },

  updatePost: async (postId, postData) => {
    const response = await axiosInstance.put(`/posts/${postId}`, postData)
    return response.data
  },

  deletePost: async (postId) => {
    const response = await axiosInstance.delete(`/posts/${postId}`)
    return response.data
  },

  toggleLike: async (postId) => {
    const response = await axiosInstance.post(`/posts/${postId}/like`)
    return response.data
  },

  getComments: async (postId, page = 1, limit = 10, parentId = null) => {
    const params = new URLSearchParams({ page, limit })
    if (parentId) params.append('parentId', parentId)
    const response = await axiosInstance.get(`/posts/${postId}/comments?${params}`)
    return response.data
  },

  addComment: async (postId, content) => {
    const response = await axiosInstance.post(`/posts/${postId}/comments`, { content })
    return response.data
  },

  addReply: async (postId, parentCommentId, content) => {
    const response = await axiosInstance.post(`/posts/${postId}/comments`, {
      content,
      parentCommentId,
    })
    return response.data
  },

  toggleCommentLike: async (commentId) => {
    const response = await axiosInstance.post(`/posts/comments/${commentId}/like`)
    return response.data
  },

  deleteComment: async (commentId) => {
    const response = await axiosInstance.delete(`/posts/comments/${commentId}`)
    return response.data
  },

  sharePost: async (postId, shareData) => {
    const response = await axiosInstance.post(`/posts/${postId}/share`, shareData)
    return response.data
  },
}

export default postService
