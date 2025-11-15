
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateProfileImage } from '../../store/slices/authSlice';
import { 
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  MapPinIcon,
  CalendarIcon,
  XMarkIcon,
  CheckIcon,
  DocumentTextIcon,
  CameraIcon,
  PhotoIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  UserMinusIcon,
  ClockIcon,
  UserGroupIcon,
  BookmarkIcon,
  ShieldCheckIcon,
  CogIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import PostList from '../../components/Post/PostList';
import { Avatar } from '../../components';
import EmailVerification from './EmailVerification';
import { userServices } from '../../services/api';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const Profile = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userId } = useParams();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [educationData, setEducationData] = useState([]);
  const [workExperienceData, setWorkExperienceData] = useState([]);
  
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarksError, setBookmarksError] = useState(null);
  
  const [friendshipStatus, setFriendshipStatus] = useState(null);
  const [friendRequestSending, setFriendRequestSending] = useState(false);
  const [friendActionSuccess, setFriendActionSuccess] = useState(null);
  const [userFriends, setUserFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || '/user/api';
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Reset states when userId changes
  useEffect(() => {
    setUserData(null);
    setUserPosts([]);
    setEducationData([]);
    setWorkExperienceData([]);
    setUserFriends([]);
    setFriendshipStatus(null);
    setIsOwnProfile(false);
    setBookmarkedPosts([]);
    setLoading(true);
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      let endpoint;
      if (userId) {
        endpoint = `${API_URL}/users/${userId}`;
      } else {
        endpoint = `${API_URL}/auth/me`;
      }

      // 🔥 FIX: REMOVE cache-control headers that cause CORS issues
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
          // ❌ REMOVED: 'Cache-Control': 'no-cache'
        }
        // ❌ REMOVED: cache: 'no-store'
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { 
          state: { message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' }
        });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể tải thông tin người dùng');
      }

      const data = await response.json();
      
      // Format dates
      if (data.dateOfBirth) {
        data.dateOfBirth = new Date(data.dateOfBirth).toISOString();
      }
      if (data.createdAt) {
        data.createdAt = new Date(data.createdAt).toISOString();
      }
      if (data.lastLoginAt) {
        data.lastLoginAt = new Date(data.lastLoginAt).toISOString();
      }

      setUserData(data);

      // Get extended profile data - FIXED error handling
      try {
        const targetUserId = userId || data.userID;
        if (targetUserId) {
          const extendedProfileResponse = await userServices.getUserProfile(targetUserId);
          if (extendedProfileResponse && extendedProfileResponse.data) {
            const extendedData = extendedProfileResponse.data.profile || extendedProfileResponse.data;
            
            if (extendedData.education) {
              setEducationData(extendedData.education);
            }
            
            if (extendedData.workExperience) {
              setWorkExperienceData(extendedData.workExperience);
            }
          }
        }
      } catch (profileError) {
        console.error("Error fetching extended profile:", profileError);
        // Continue without extended data - don't break the whole component
      }

      // Check if this is the user's own profile
      if (!userId) {
        setIsOwnProfile(true);
      } else {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = currentUser.userID || currentUser.id;
        setIsOwnProfile(currentUserId === parseInt(userId));
        
        if (currentUserId !== parseInt(userId)) {
          fetchFriendshipStatus(userId);
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [navigate, userId]);

  const fetchFriendshipStatus = async (targetUserId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/friendships/status/${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setFriendshipStatus(null);
          return;
        }
        throw new Error('Could not fetch friendship status');
      }

      const data = await response.json();
      setFriendshipStatus(data.status);
    } catch (err) {
      console.error('Error fetching friendship status:', err);
      setFriendshipStatus(null);
    }
  };

  const sendFriendRequest = async () => {
    try {
      setFriendRequestSending(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const targetUserId = userId || userData?.userID;
      if (!targetUserId) return;

      const response = await fetch(`${API_URL}/friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          friendId: targetUserId
        })
      });

      if (!response.ok) {
        throw new Error('Could not send friend request');
      }

      setFriendshipStatus('pending');
      setFriendActionSuccess('Đã gửi lời mời kết bạn');
      setTimeout(() => setFriendActionSuccess(null), 3000);
    } catch (err) {
      console.error('Error sending friend request:', err);
      setUploadError('Không thể gửi lời mời kết bạn');
    } finally {
      setFriendRequestSending(false);
    }
  };

  const acceptFriendRequest = async () => {
    try {
      setFriendRequestSending(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const targetUserId = userId || userData?.userID;
      if (!targetUserId) return;

      const response = await fetch(`${API_URL}/friendships/${targetUserId}/accept`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not accept friend request');
      }

      setFriendshipStatus('accepted');
      setFriendActionSuccess('Đã chấp nhận lời mời kết bạn');
      setTimeout(() => setFriendActionSuccess(null), 3000);
    } catch (err) {
      console.error('Error accepting friend request:', err);
      setUploadError('Không thể chấp nhận lời mời kết bạn');
    } finally {
      setFriendRequestSending(false);
    }
  };

  const rejectFriendRequest = async () => {
    try {
      setFriendRequestSending(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const targetUserId = userId || userData?.userID;
      if (!targetUserId) return;

      const response = await fetch(`${API_URL}/friendships/${targetUserId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not reject friend request');
      }

      setFriendshipStatus('rejected');
      setFriendActionSuccess('Đã từ chối lời mời kết bạn');
      setTimeout(() => setFriendActionSuccess(null), 3000);
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      setUploadError('Không thể từ chối lời mời kết bạn');
    } finally {
      setFriendRequestSending(false);
    }
  };

  const removeFriend = async () => {
    try {
      setFriendRequestSending(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const targetUserId = userId || userData?.userID;
      if (!targetUserId) return;

      const response = await fetch(`${API_URL}/friendships/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not remove friend');
      }

      setFriendshipStatus(null);
      setFriendActionSuccess('Đã hủy kết bạn');
      setTimeout(() => setFriendActionSuccess(null), 3000);
    } catch (err) {
      console.error('Error removing friend:', err);
      setUploadError('Không thể hủy kết bạn');
    } finally {
      setFriendRequestSending(false);
    }
  };

  useEffect(() => {
    const fetchUserPosts = async () => {
      try {
        setPostsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) return;

        const targetUserId = userId || userData?.userID;
        if (!targetUserId) return;

        const response = await fetch(`${API_URL}/posts/user/${targetUserId}?limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Could not fetch user posts');
        }

        const data = await response.json();
        setUserPosts(data.posts || []);
      } catch (err) {
        console.error('Error fetching user posts:', err);
        setPostsError(err.message);
      } finally {
        setPostsLoading(false);
      }
    };

    if (userData || userId) {
      fetchUserPosts();
    }
  }, [userData, userId]);

  const handleProfilePictureClick = () => {
    if (isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProfilePictureChange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Chỉ chấp nhận file JPG, PNG và GIF');
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setUploadingImage(true);
      setUploadError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/settings/profile-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể upload ảnh đại diện');
      }
      
      const data = await response.json();
      
      // 🔥 FIX: Thêm timestamp để tránh cache
      const timestamp = new Date().getTime();
      const newProfileImage = data.profileImage ? `${data.profileImage}?t=${timestamp}` : data.profileImage;
      
      setUserData(prev => ({
        ...prev,
        image: newProfileImage
      }));
      
      // Update localStorage
      try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        currentUser.image = newProfileImage;
        
        if (currentUser.avatar) {
          currentUser.avatar = newProfileImage;
        }
        
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Update Redux store
        dispatch(updateProfileImage(newProfileImage));
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: { profileImage: newProfileImage }
        }));
      } catch (storageError) {
        console.error('Error updating user in localStorage:', storageError);
      }
      
      // Refresh user data
      await fetchUserData();
      
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
      
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setUploadError(err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStartChat = () => {
    try {
      if (!userData) {
        console.error('No user data available');
        return;
      }
      
      const userId = userData.userID || userData.id;
      if (!userId) {
        console.error('User ID is missing');
        return;
      }
      
      const userDataForChat = {
        userID: userId,
        id: userId,
        fullName: userData.fullName || userData.username,
        username: userData.username,
        email: userData.email,
        image: userData.image || userData.avatar
      };
      
      localStorage.setItem('selectedUserFromProfile', JSON.stringify(userDataForChat));
      
      navigate(`/chat`, { 
        state: { 
          selectedUser: userDataForChat,
          source: 'profile'
        } 
      });
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      setFriendsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const targetUserId = userId || userData?.userID;
      if (!targetUserId) return;

      let endpoint = `${API_URL}/friendships/user/${targetUserId}`;
      if (!userId && isOwnProfile) {
        endpoint = `${API_URL}/friendships`;
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch friends');
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setUserFriends(data);
      } else if (data.friends) {
        setUserFriends(data.friends);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
      setFriendsError(err.message);
    } finally {
      setFriendsLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.userID || userId) {
      fetchFriends();
    }
  }, [userData, userId, isOwnProfile]);

  const fetchBookmarkedPosts = async () => {
    if (!isOwnProfile) return;
    
    try {
      setBookmarksLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/posts/bookmarks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch bookmarked posts');
      }

      const data = await response.json();
      setBookmarkedPosts(data.posts || []);
    } catch (err) {
      console.error('Error fetching bookmarked posts:', err);
      setBookmarksError(err.message);
    } finally {
      setBookmarksLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'saved' && isOwnProfile && bookmarkedPosts.length === 0 && !bookmarksLoading) {
      fetchBookmarkedPosts();
    }
  }, [activeTab, isOwnProfile]);

  const handleBookmark = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle bookmark');
      }
      
      if (activeTab === 'saved') {
        setBookmarkedPosts(prev => prev.filter(post => post.postID !== postId));
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Could not like post');
      }

      setUserPosts(userPosts.map(post => {
        if (post.postID === postId) {
          return {
            ...post,
            liked: !post.liked,
            likesCount: post.liked ? post.likesCount - 1 : post.likesCount + 1
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleComment = async (postId, change = 1) => {
    try {
      setUserPosts(userPosts.map(post => {
        if (post.postID === postId) {
          return {
            ...post,
            commentsCount: Math.max(0, post.commentsCount + change)
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Comment update error:', error);
    }
  };

  const handleEditPost = async (postId, updatedContent) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: updatedContent
        })
      });

      if (!response.ok) {
        throw new Error('Could not update post');
      }

      setUserPosts(userPosts.map(post => {
        if (post.postID === postId) {
          return {
            ...post,
            content: updatedContent,
            isEdited: true
          };
        }
        return post;
      }));
      
      return true;
    } catch (error) {
      console.error('Error editing post:', error);
      return false;
    }
  };

  const refreshPostMedia = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/posts/${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch updated post');
      }

      const updatedPost = await response.json();

      setUserPosts(userPosts.map(post => {
        if (post.postID === postId) {
          return {
            ...post,
            media: updatedPost.media,
            isEdited: true
          };
        }
        return post;
      }));
      
      return true;
    } catch (error) {
      console.error('Error refreshing post media:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // 🔥 FIX: Thêm cache-busting cho avatar
  const getAvatarUrl = (imageUrl) => {
    if (!imageUrl) return null;
    const timestamp = new Date().getTime();
    return `${imageUrl}?t=${timestamp}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {updateSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50 flex items-center justify-between">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 mr-2" />
            <span>Cập nhật thông tin thành công!</span>
          </div>
          <button onClick={() => setUpdateSuccess(false)} className="ml-4 text-green-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {friendActionSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50 flex items-center justify-between">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 mr-2" />
            <span>{friendActionSuccess}</span>
          </div>
          <button onClick={() => setFriendActionSuccess(null)} className="ml-4 text-green-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {uploadError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 flex items-center justify-between">
          <div className="flex items-center">
            <XMarkIcon className="h-5 w-5 mr-2" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="ml-4 text-red-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      
      <div className="max-w-full mx-auto">
        <div className="flex flex-col lg:flex-row min-h-screen">
          {/* Left Sidebar - Profile Info */}
          <div className="w-full lg:w-80 flex-shrink-0 bg-white border-r border-gray-200">
            <div className="p-6 h-full">
              {/* Profile Header */}
              <div className="mb-6">
                <div className="flex flex-col items-center sm:items-start">
                  <div className="relative mb-4">
                    {isOwnProfile && (
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        accept="image/*"
                      />
                    )}
                    
                    <div className="relative">
                      <Avatar 
                        src={getAvatarUrl(userData?.image)}
                        name={userData?.fullName}
                        alt={userData?.fullName}
                        size="xl"
                        className="w-24 h-24 border-2 border-gray-200"
                        onClick={isOwnProfile ? handleProfilePictureClick : undefined}
                      />
                      
                      {isOwnProfile && (
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full cursor-pointer" onClick={handleProfilePictureClick}>
                          {uploadingImage ? (
                            <ArrowPathIcon className="h-6 w-6 text-white animate-spin" />
                          ) : (
                            <CameraIcon className="h-6 w-6 text-white" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center sm:text-left mb-4 w-full">
                    <h1 className="text-xl font-bold text-gray-900 mb-1">
                      {userData?.fullName}
                    </h1>
                    <p className="text-gray-600 text-sm mb-2">@{userData?.username}</p>
                    <p className="text-gray-500 text-sm">
                      {userData?.role === 'STUDENT' ? 'Học sinh' : userData?.role === 'TEACHER' ? 'Giáo viên' : 'Quản trị viên'}
                    </p>
                  </div>

                  <div className="flex gap-2 w-full mb-6">
                    {!isOwnProfile && (
                      <>
                        {friendshipStatus === null && (
                          <button
                            onClick={sendFriendRequest}
                            disabled={friendRequestSending}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                          >
                            {friendRequestSending ? 
                              <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 
                              <UserPlusIcon className="h-4 w-4" />
                            }
                            <span>Kết bạn</span>
                          </button>
                        )}
                        
                        {friendshipStatus === 'pending' && (
                          <button
                            onClick={acceptFriendRequest}
                            disabled={friendRequestSending}
                            className="flex-1 px-3 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition flex items-center justify-center gap-2"
                          >
                            {friendRequestSending ? 
                              <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 
                              <ClockIcon className="h-4 w-4" />
                            }
                            <span>Chấp nhận</span>
                          </button>
                        )}
                        
                        {friendshipStatus === 'accepted' && (
                          <button
                            onClick={removeFriend}
                            disabled={friendRequestSending}
                            className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition flex items-center justify-center gap-2"
                          >
                            {friendRequestSending ? 
                              <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 
                              <UserMinusIcon className="h-4 w-4" />
                            }
                            <span>Bạn bè</span>
                          </button>
                        )}

                        <button
                          onClick={handleStartChat}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          <span>Chat</span>
                        </button>
                      </>
                    )}
                    
                    {isOwnProfile && (
                      <button
                        onClick={() => navigate('/settings', { state: { activeTab: 'general' } })}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
                      >
                        <CogIcon className="h-4 w-4" />
                        <span>Chỉnh sửa hồ sơ</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{userPosts.length}</div>
                    <div className="text-xs text-gray-500">Bài viết</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{userFriends.length}</div>
                    <div className="text-xs text-gray-500">Bạn bè</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {isOwnProfile ? bookmarkedPosts.length : 0}
                    </div>
                    <div className="text-xs text-gray-500">Đã lưu</div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-6">
                <div className="space-y-3">
                  {userData?.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <EnvelopeIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <span className="truncate">{userData.email}</span>
                      {(userData?.EmailVerified === true || userData?.emailVerified === true) ? (
                        <ShieldCheckIcon className="h-4 w-4 ml-2 text-green-500" />
                      ) : (
                        <span className="ml-2 text-xs text-red-500">(Chưa xác thực)</span>
                      )}
                    </div>
                  )}
                  
                  {userData?.phoneNumber && (
                    <div className="flex items-center text-sm text-gray-600">
                      <PhoneIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <span>{userData.phoneNumber}</span>
                    </div>
                  )}
                  
                  {userData?.school && (
                    <div className="flex items-center text-sm text-gray-600">
                      <BuildingLibraryIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <span className="truncate">{userData.school}</span>
                    </div>
                  )}
                  
                  {userData?.address && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPinIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <span className="truncate">{userData.address}</span>
                    </div>
                  )}
                  
                  {userData?.dateOfBirth && (
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-3 text-gray-400" />
                      <span>Ngày sinh: {formatDate(userData.dateOfBirth)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <ClockIcon className="h-4 w-4 mr-3 text-gray-400" />
                    <span>Tham gia {formatDate(userData?.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Education */}
              {educationData.length > 0 && (
                <div className="mb-6 border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <AcademicCapIcon className="h-4 w-4 mr-2" />
                    Học vấn
                  </h3>
                  <div className="space-y-3">
                    {educationData.slice(0, 2).map((edu, index) => (
                      <div key={edu.id || index} className="text-sm">
                        <div className="font-medium text-gray-900">{edu.school}</div>
                        <div className="text-gray-600">
                          {edu.degree} {edu.field ? `- ${edu.field}` : ''}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {edu.startDate && format(new Date(edu.startDate), 'MM/yyyy', { locale: vi })} - {edu.current ? 'Hiện tại' : edu.endDate && format(new Date(edu.endDate), 'MM/yyyy', { locale: vi })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              {workExperienceData.length > 0 && (
                <div className="mb-6 border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <BriefcaseIcon className="h-4 w-4 mr-2" />
                    Kinh nghiệm
                  </h3>
                  <div className="space-y-3">
                    {workExperienceData.slice(0, 2).map((work, index) => (
                      <div key={work.id || index} className="text-sm">
                        <div className="font-medium text-gray-900">{work.company}</div>
                        <div className="text-gray-600">{work.position}</div>
                        <div className="text-gray-500 text-xs">
                          {work.startDate && format(new Date(work.startDate), 'MM/yyyy', { locale: vi })} - {work.current ? 'Hiện tại' : work.endDate && format(new Date(work.endDate), 'MM/yyyy', { locale: vi })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends Preview */}
              {userFriends.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    Bạn bè ({userFriends.length})
                  </h3>
                  <div className="grid grid-cols-6 gap-2">
                    {userFriends.slice(0, 6).map(friend => (
                      <div 
                        key={friend.userID || friend.friendID}
                        className="cursor-pointer"
                        onClick={() => navigate(`/profile/${friend.userID || friend.friendID}`)}
                      >
                        <Avatar 
                          src={getAvatarUrl(friend.image || friend.friendProfilePicture)}
                          name={friend.fullName || friend.friendFullName}
                          size="sm"
                          className="w-8 h-8"
                        />
                      </div>
                    ))}
                  </div>
                  {userFriends.length > 6 && (
                    <button 
                      className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                      onClick={() => navigate(isOwnProfile ? '/friends' : `/friends?userId=${userId}`)}
                    >
                      Xem tất cả {userFriends.length} bạn bè
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Posts */}
          <div className="flex-1 min-w-0 bg-white">
            {/* Navigation Tabs - FIXED: Mobile responsive */}
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto no-scrollbar">
                <button
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'all' 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('all')}
                >
                  <div className="flex items-center justify-center gap-2 min-w-max">
                    <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden xs:inline">Bài viết</span>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs min-w-[20px] text-center">
                      {userPosts.length}
                    </span>
                  </div>
                </button>
                
                <button
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'image' 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('image')}
                >
                  <div className="flex items-center justify-center gap-2 min-w-max">
                    <PhotoIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden xs:inline">Ảnh</span>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs min-w-[20px] text-center">
                      {filteredPosts(userPosts, 'image').length}
                    </span>
                  </div>
                </button>
                
                <button
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'video' 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('video')}
                >
                  <div className="flex items-center justify-center gap-2 min-w-max">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden xs:inline">Video</span>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs min-w-[20px] text-center">
                      {filteredPosts(userPosts, 'video').length}
                    </span>
                  </div>
                </button>
                
                {isOwnProfile && (
                  <button
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'saved' 
                        ? 'border-blue-500 text-blue-600 bg-blue-50' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('saved')}
                  >
                    <div className="flex items-center justify-center gap-2 min-w-max">
                      <BookmarkIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden xs:inline">Đã lưu</span>
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs min-w-[20px] text-center overflow-hidden">
                        {bookmarkedPosts.length}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-screen">
              {/* Posts Content */}
              {activeTab === 'saved' ? (
                <div className="p-4 sm:p-6">
                  {bookmarksLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Đang tải bài viết đã lưu...</p>
                    </div>
                  ) : bookmarksError ? (
                    <div className="text-center py-12">
                      <p className="text-red-600">Không thể tải bài viết đã lưu: {bookmarksError}</p>
                    </div>
                  ) : bookmarkedPosts.length === 0 ? (
                    <div className="text-center py-12">
                      <BookmarkIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có bài viết đã lưu</h3>
                      <p className="text-gray-500 mb-4">Bài viết bạn lưu sẽ hiển thị tại đây.</p>
                      <button
                        onClick={() => navigate('/posts')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Khám phá bài viết
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <PostList 
                        initialPosts={bookmarkedPosts} 
                        onLike={handleLike}
                        onComment={handleComment}
                        onShare={(postId) => console.log('Share:', postId)}
                        onEdit={handleEditPost}
                        onRefreshMedia={refreshPostMedia}
                        onBookmark={handleBookmark}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  {postsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Đang tải bài viết...</p>
                    </div>
                  ) : postsError ? (
                    <div className="text-center py-12">
                      <p className="text-red-600">Không thể tải bài viết: {postsError}</p>
                    </div>
                  ) : filteredPosts(userPosts, activeTab).length === 0 ? (
                    <div className="text-center py-12">
                      <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {activeTab === 'all' && 'Chưa có bài viết'}
                        {activeTab === 'image' && 'Chưa có bài viết với ảnh'}
                        {activeTab === 'video' && 'Chưa có bài viết với video'}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        {isOwnProfile 
                          ? 'Hãy chia sẻ điều gì đó với cộng đồng!' 
                          : `${userData?.fullName} chưa chia sẻ ${activeTab === 'all' ? 'bài viết' : activeTab === 'image' ? 'ảnh' : 'video'} nào.`
                        }
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => navigate('/posts')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Tạo bài viết đầu tiên
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <PostList 
                        initialPosts={filteredPosts(userPosts, activeTab)} 
                        onLike={handleLike}
                        onComment={handleComment}
                        onShare={(postId) => console.log('Share:', postId)}
                        onEdit={handleEditPost}
                        onRefreshMedia={refreshPostMedia}
                        onBookmark={handleBookmark}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for hiding scrollbar */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

// Helper function to filter posts by tab
function filteredPosts(posts, tab) {
  if (!Array.isArray(posts)) return [];
  if (tab === 'all') return posts;
  if (tab === 'image') {
    return posts.filter(post => Array.isArray(post.media) && post.media.some(m => m.MediaType === 'image'));
  }
  if (tab === 'video') {
    return posts.filter(post => Array.isArray(post.media) && post.media.some(m => m.MediaType === 'video'));
  }
  return posts;
}

export default Profile;