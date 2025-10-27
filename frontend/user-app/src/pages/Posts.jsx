import { BookmarkIcon, ChatBubbleLeftIcon, ClockIcon, FireIcon, HandThumbUpIcon, MagnifyingGlassIcon, PencilIcon, ShareIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, HandThumbUpIcon as ThumbUpSolid } from '@heroicons/react/24/solid';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import courseApi from '../api/courseApi';
import { Avatar } from '../components/index';
import CreatePost from '../components/Post/CreatePost';
import SharePostModal from '../components/Post/SharePostModal';

// Base URL for media files
const BASE_URL = 'http://localhost:8080';

// Custom styles for Markdown elements
const markdownStyles = {
  table: 'min-w-full border border-gray-300 border-collapse my-4',
  thead: 'bg-gray-50',
  th: 'border border-gray-300 px-4 py-2 font-semibold text-left',
  td: 'border border-gray-300 px-4 py-2',
  ul: 'list-disc pl-6 space-y-1 my-4',
  ol: 'list-decimal pl-6 space-y-1 my-4',
  li: 'pl-1',
};

// Components mapping for ReactMarkdown
const markdownComponents = {
  table: ({ node, ...props }) => <table className={markdownStyles.table} {...props} />,
  thead: ({ node, ...props }) => <thead className={markdownStyles.thead} {...props} />,
  th: ({ node, ...props }) => <th className={markdownStyles.th} {...props} />,
  td: ({ node, ...props }) => <td className={markdownStyles.td} {...props} />,
  ul: ({ node, ...props }) => <ul className={markdownStyles.ul} {...props} />,
  ol: ({ node, ...props }) => <ol className={markdownStyles.ol} {...props} />,
  li: ({ node, ...props }) => <li className={markdownStyles.li} {...props} />,
};

// Hàm chuẩn hóa dữ liệu bài viết
const normalizePostData = (post) => ({
  postId: post.postID || post.postID,
  fullName: post.fullName || post.FullName,
  createdAt: post.createdAt || post.CreatedAt,
  content: post.content || post.Content || '',
  title: post.title || post.Title || '',
  likesCount: post.likesCount || post.LikesCount || 0,
  commentsCount: post.commentsCount || post.CommentsCount || 0,
  bookmarksCount: post.bookmarksCount || post.BookmarksCount || 0,
  sharesCount: post.sharesCount || post.SharesCount || 0,
  media: post.media
    ? post.media.map((media) => ({
        mediaType: media.mediaType || media.MediaType,
        mediaUrl: media.mediaUrl || media.MediaUrl,
        thumbnailUrl: media.thumbnailUrl || media.ThumbnailUrl,
      }))
    : [],
  userImage: post.userImage || post.UserImage,
  isLiked: post.liked || post.liked || false,
  isBookmarked: post.isBookmarked || post.IsBookmarked || false,
  userId: post.userID || post.UserID,
});

// Hàm chuẩn hóa dữ liệu bình luận
const normalizeCommentData = (comment) => ({
  commentId: comment.commentID || comment.CommentID,
  fullName: comment.fullName || comment.FullName,
  content: comment.content || comment.Content,
  createdAt: comment.createdAt || comment.CreatedAt,
  userImage: comment.userImage || comment.UserImage,
  likesCount: comment.likesCount || comment.LikesCount || 0,
  isLiked: comment.Liked || comment.liked || false,
  userId: comment.userID || comment.UserID,
});

// Hàm chuẩn hóa URL media
const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/uploads/') ? url : `/uploads/${url}`}`;
};

const Posts = () => {
  const commentsRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('latest');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedPostForShare, setSelectedPostForShare] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [videoThumbnails, setVideoThumbnails] = useState({});

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const postId = queryParams.get('postId');
    const commentId = queryParams.get('commentId');

    if (postId) {
      setSelectedPost(postId);
      if (commentId) {
        setSelectedComment(commentId);
      }
    }

    fetchPosts();
  }, [activeFilter, location.search]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPosts(posts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = posts.filter((post) => {
        const content = post?.content || '';
        const title = post?.title || '';
        const authorName = post?.fullName || '';

        return (
          content.toLowerCase().includes(query) ||
          title.toLowerCase().includes(query) ||
          authorName.toLowerCase().includes(query)
        );
      });
      setFilteredPosts(filtered);
    }
  }, [searchQuery, posts]);

  const calculatePostScore = (post) => {
    const now = new Date().getTime();
    const postDate = new Date(post.createdAt).getTime();
    const postAgeInDays = (now - postDate) / (1000 * 60 * 60 * 24);

    const likeWeight = 1;
    const commentWeight = 1.5;
    const bookmarkWeight = 2;
    const shareWeight = 1.2;

    const timeDecayFactor = 1 / Math.log(postAgeInDays + 2);

    const engagementScore =
      (post.likesCount || 0) * likeWeight +
      (post.commentsCount || 0) * commentWeight +
      (post.bookmarksCount || 0) * bookmarkWeight +
      (post.sharesCount || 0) * shareWeight;

    const randomFactor = 0.9 + Math.random() * 0.2;

    return engagementScore * timeDecayFactor * randomFactor;
  };

  const fetchPosts = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/posts?limit=1000', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Không thể tải bài viết');

      const data = await response.json();
      const postsWithFullMediaPaths = (data.posts || []).map(normalizePostData);

      let sortedPosts = [...postsWithFullMediaPaths];

      if (activeFilter === 'trending') {
        sortedPosts.forEach((post) => (post._score = calculatePostScore(post)));
        sortedPosts.sort((a, b) => b._score - a._score);
      } else if (activeFilter === 'latest') {
        sortedPosts.sort((a, b) => {
          const dateA = new Date(a.createdAt).setHours(0, 0, 0, 0);
          const dateB = new Date(b.createdAt).setHours(0, 0, 0, 0);
          if (dateA === dateB) return calculatePostScore(b) - calculatePostScore(a);
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }

      setPosts(sortedPosts);
      setFilteredPosts(sortedPosts);

      if (selectedPost) {
        const postExists = sortedPosts.some((post) => post.postId.toString() === selectedPost.toString());
        if (!postExists) fetchSinglePost(selectedPost);
      }

      if (!selectedVideo && sortedPosts.length > 0) {
        setSelectedVideo(sortedPosts[0]);
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSinglePost = async (postId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Không thể tải bài viết');

      const data = await response.json();
      if (data.post) {
        const normalizedPost = normalizePostData(data.post);
        setPosts((prev) => {
          if (!prev.some((p) => p.postId.toString() === postId.toString())) {
            return [normalizedPost, ...prev];
          }
          return prev;
        });
        setSelectedVideo(normalizedPost);
      }
    } catch (error) {
      console.error('Fetch single post error:', error);
    }
  };

  const handlePostCreated = () => {
    fetchPosts();
    setShowSuccess(true);
    setShowCreateForm(false);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // LIKE HOÀN CHỈNH - CẬP NHẬT NGAY, ROLLBACK CHUẨN
  const handleLike = async (postId) => {
    const post = posts.find(p => p.postId === postId);
    if (!post) return;

    const wasLiked = post.isLiked;
    const delta = wasLiked ? -1 : 1;
    const newLikesCount = post.likesCount + delta;

    // Cập nhật UI ngay
    setPosts(prev =>
      prev.map(p =>
        p.postId === postId
          ? { ...p, isLiked: !wasLiked, likesCount: newLikesCount }
          : p
      )
    );

    if (selectedVideo?.postId === postId) {
      setSelectedVideo(prev => ({
        ...prev,
        isLiked: !wasLiked,
        likesCount: newLikesCount,
      }));
    }

    try {
      const response = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Like failed');
      // API OK → UI đã đúng → không làm gì
    } catch (error) {
      console.error('Like error:', error);

      // ROLLBACK về trạng thái ban đầu
      setPosts(prev =>
        prev.map(p =>
          p.postId === postId
            ? { ...p, isLiked: wasLiked, likesCount: post.likesCount }
            : p
        )
      );

      if (selectedVideo?.postId === postId) {
        setSelectedVideo(prev => ({
          ...prev,
          isLiked: wasLiked,
          likesCount: post.likesCount,
        }));
      }

      alert('Không thể thực hiện thao tác. Vui lòng thử lại.');
    }
  };

  const handleComment = (postId, change = 1) => {
    setPosts(posts.map(post =>
      post.postId === postId
        ? { ...post, commentsCount: Math.max(0, post.commentsCount + change) }
        : post
    ));
  };

  const clearSelection = () => {
    setSelectedPost(null);
    setSelectedComment(null);
    navigate('/posts');
  };

  const filters = [
    { id: 'latest', name: 'Mới nhất', icon: ClockIcon },
    { id: 'trending', name: 'Xu hướng', icon: FireIcon },
  ];

  const handleStoryClick = (index) => {
    setCurrentStoryIndex(index);
    setShowStoryModal(true);
  };

  const handleNextStory = () => {
    const nextIndex = currentStoryIndex + 1;
    if (nextIndex < posts.length) setCurrentStoryIndex(nextIndex);
    else setShowStoryModal(false);
  };

  const handlePrevStory = () => {
    const prevIndex = currentStoryIndex - 1;
    if (prevIndex >= 0) setCurrentStoryIndex(prevIndex);
  };

  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        setCoursesLoading(true);
        const response = await courseApi.getAllCourses();
        if (response.data?.success) {
          setFeaturedCourses((response.data.data || []).slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchFeaturedCourses();
  }, []);

  const formatPrice = (price) => {
    const numericPrice = parseFloat(price);
    return isNaN(numericPrice) ? 0 : numericPrice;
  };

  const handleCourseClick = (courseId) => {
    navigate(`/courses/${courseId}`);
  };

  const handleShare = (postId) => {
    const post = posts.find(p => p.postId === postId);
    if (post) setSelectedPostForShare(post);
  };

  const handleShareComplete = (postId) => {
    setPosts(posts.map(post =>
      post.postId === postId
        ? { ...post, sharesCount: (post.sharesCount || 0) + 1 }
        : post
    ));
  };

  const handleVideoSelect = (post) => {
    setSelectedVideo(post);
    setCurrentMediaIndex(0);
    navigate(`/posts?postId=${post.postId}`);
  };

  const handleBookmark = async (postId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Bookmark failed');

      setPosts(prev =>
        prev.map(post =>
          post.postId === postId
            ? { ...post, isBookmarked: !post.isBookmarked }
            : post
        )
      );

      if (selectedVideo?.postId === postId) {
        setSelectedVideo(prev => ({ ...prev, isBookmarked: !prev.isBookmarked }));
      }
    } catch (error) {
      console.error('Bookmark error:', error);
    }
  };

  const fetchComments = async (postId) => {
    if (!postId) return;
    setIsLoadingComments(true);
    setCommentError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/posts/${postId}/comments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Load comments failed');
      const data = await response.json();
      setComments((data.comments || []).map(normalizeCommentData));
    } catch (error) {
      setCommentError('Không thể tải bình luận');
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    if (selectedVideo) fetchComments(selectedVideo.postId);
  }, [selectedVideo]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedVideo) return;
    setSubmittingComment(true);
    setCommentError(null);

    try {
      const response = await fetch(`${BASE_URL}/api/posts/${selectedVideo.postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ content: newComment }),
      });

      // đọc text rồi parse để tránh crash nếu server trả non-JSON
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        console.warn('Non-JSON comment response:', text);
        data = text;
      }

      if (!response.ok) {
        console.error('Add comment failed', response.status, data);
        throw new Error((data && data.message) || 'Không thể gửi bình luận');
      }

      // Normalize many possible shapes from server
      const commentObjRaw = (data && (data.comment || data.data?.comment || data.data)) || data || {};
      const normalized = normalizeCommentData(commentObjRaw);

      // Use server id if provided; fallback to temp id for optimistic UI
      const normalizedWithId = {
        ...normalized,
        commentId: normalized.commentId || `tmp-${Date.now()}`,
        createdAt: normalized.createdAt || new Date().toISOString(),
      };

      // Update UI optimistically using server response (no full refetch)
      setComments(prev => {
        // avoid duplicate if server returns same id twice
        if (prev.some(c => c.commentId === normalizedWithId.commentId)) return prev;
        return [normalizedWithId, ...prev];
      });
      setNewComment('');

      // Update counters locally (posts list + selectedVideo)
      setPosts(prev => prev.map(p =>
        p.postId === selectedVideo.postId
          ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
          : p
      ));
      setSelectedVideo(prev => prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev);
      handleComment(selectedVideo.postId);
    } catch (error) {
      console.error('handleSubmitComment error:', error);
      setCommentError(error.message || 'Không thể gửi bình luận');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/posts/comments/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Like comment failed');
      setComments(prev =>
        prev.map(c =>
          c.commentId === commentId
            ? { ...c, isLiked: !c.isLiked, likesCount: c.isLiked ? c.likesCount - 1 : c.likesCount + 1 }
            : c
        )
      );
    } catch (error) {
      console.error('Like comment error:', error);
    }
  };

  const handleDeleteComment = async (commentId, postId = null) => {
    try {
      // prefer explicit postId param, fallback to selectedVideo
      const targetPostId = postId || selectedVideo?.postId;
      if (!targetPostId) {
        console.warn('No postId provided for delete-comment');
      }

      // call DELETE with postId in URL so backend can update/return it reliably
      const url = targetPostId
        ? `${BASE_URL}/api/posts/${targetPostId}/comments/${commentId}`
        : `${BASE_URL}/api/posts/comments/${commentId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      // robust parse
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

      if (!response.ok) {
        throw new Error(data.message || 'Delete failed');
      }

      // Determine postId from response if backend returns it, otherwise use targetPostId
      const returnedPostId =
        data.postId ||
        data.postID ||
        data.data?.postId ||
        data.data?.postID ||
        targetPostId;

      // remove comment from UI
      setComments(prev => prev.filter(c => c.commentId !== commentId));

      if (returnedPostId) {
        // decrement counters
        handleComment(returnedPostId, -1);

        // keep posts list and selectedVideo in sync
        setPosts(prev =>
          prev.map(p =>
            p.postId === returnedPostId
              ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) }
              : p
          )
        );

        if (selectedVideo?.postId === returnedPostId) {
          setSelectedVideo(prev => prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 1) - 1) } : prev);
        }
      }
    } catch (error) {
      console.error('Delete comment error:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Vừa xong';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleReportPost = async (postId, reportData) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ targetId: postId, ...reportData }),
      });
      if (!response.ok) throw new Error('Report failed');
      setReportSuccess(true);
      setTimeout(() => setReportSuccess(false), 3000);
      return true;
    } catch (error) {
      console.error('Report error:', error);
      return false;
    }
  };

  const generateVideoThumbnail = (videoUrl, postId) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    const formattedUrl = getMediaUrl(videoUrl);
    video.src = formattedUrl;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration || 1);
    });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg');
        setVideoThumbnails(prev => ({ ...prev, [postId]: dataUrl }));
      } catch (error) {
        console.error('Thumbnail error:', error);
      }
      video.remove();
    });

    video.addEventListener('error', () => {});
    video.load();
  };

  useEffect(() => {
    posts.forEach(post => {
      if (
        post.media?.length > 0 &&
        post.media[0].mediaType === 'video' &&
        !videoThumbnails[post.postId]
      ) {
        generateVideoThumbnail(post.media[0].mediaUrl, post.postId);
      }
    });
  }, [posts]);

  const handleNextMedia = () => {
    if (selectedVideo && currentMediaIndex < selectedVideo.media.length - 1) {
      setCurrentMediaIndex(currentMediaIndex + 1);
    }
  };

  const handlePrevMedia = () => {
    if (currentMediaIndex > 0) setCurrentMediaIndex(currentMediaIndex - 1);
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50 flex items-center justify-between">
          <span>Đăng bài thành công!</span>
          <button onClick={() => setShowSuccess(false)} className="ml-4 text-green-700">×</button>
        </div>
      )}

      {reportSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg z-50 flex items-center justify-between">
          <span>Báo cáo đã được gửi thành công!</span>
          <button onClick={() => setReportSuccess(false)} className="ml-4 text-yellow-700">×</button>
        </div>
      )}

      <button
        onClick={() => setShowCreateForm(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-30"
      >
        <PencilIcon className="h-6 w-6" />
      </button>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <button
                onClick={() => setShowCreateForm(false)}
                className="absolute -top-4 -right-4 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md z-10"
              >
                ×
              </button>
              <CreatePost onPostCreated={handlePostCreated} />
            </div>
          </div>
        </div>
      )}

      {selectedPostForShare && (
        <SharePostModal
          post={selectedPostForShare}
          onClose={() => setSelectedPostForShare(null)}
          onShare={handleShareComplete}
        />
      )}

      <div className="w-full mx-auto py-6 px-4">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {filters.map(filter => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg ${
                      activeFilter === filter.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{filter.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Tìm kiếm bài viết..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* MAIN POST VIEW */}
          <div className="lg:w-2/3">
            {loading ? (
              <div className="bg-white rounded-xl shadow-sm p-8 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : selectedVideo ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {selectedVideo.media?.length > 0 && (
                  <div className="relative w-full bg-black flex items-center justify-center">
                    {selectedVideo.media[currentMediaIndex].mediaType === 'video' ? (
                      <video
                        className="w-full max-h-[500px] object-contain"
                        src={getMediaUrl(selectedVideo.media[currentMediaIndex].mediaUrl)}
                        controls
                        autoPlay
                      />
                    ) : (
                      <img
                        className="w-full max-h-[500px] object-contain"
                        src={getMediaUrl(selectedVideo.media[currentMediaIndex].mediaUrl)}
                        alt="Post media"
                      />
                    )}
                    {selectedVideo.media.length > 1 && (
                      <>
                        <button
                          className={`absolute left-4 top-1/2 -translate-y-1/2 text-white z-10 ${currentMediaIndex === 0 ? 'opacity-50' : ''}`}
                          onClick={handlePrevMedia}
                          disabled={currentMediaIndex === 0}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          className={`absolute right-4 top-1/2 -translate-y-1/2 text-white z-10 ${currentMediaIndex === selectedVideo.media.length - 1 ? 'opacity-50' : ''}`}
                          onClick={handleNextMedia}
                          disabled={currentMediaIndex === selectedVideo.media.length - 1}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                          {selectedVideo.media.map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${i === currentMediaIndex ? 'bg-white' : 'bg-gray-400'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-3">
                      <Avatar src={getMediaUrl(selectedVideo.userImage)} name={selectedVideo.fullName} size="small" />
                      <div>
                        <p className="font-medium">{selectedVideo.fullName}</p>
                        <p className="text-sm text-gray-500">{formatDate(selectedVideo.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleLike(selectedVideo.postId)}
                        className={`flex items-center space-x-1 px-M3 py-1.5 rounded-full ${
                          selectedVideo.isLiked
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {selectedVideo.isLiked ? <ThumbUpSolid className="h-5 w-5" /> : <HandThumbUpIcon className="h-5 w-5" />}
                        <span>{selectedVideo.likesCount || 0}</span>
                      </button>

                      <button
                        onClick={() => handleShare(selectedVideo.postId)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        <ShareIcon className="h-5 w-5" />
                        <span>Chia sẻ</span>
                      </button>

                      <button
                        onClick={() => handleBookmark(selectedVideo.postId)}
                        className={`p-2 rounded-full ${selectedVideo.isBookmarked ? 'bg-blue-100 text-blue-600' : 'bg541-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {selectedVideo.isBookmarked ? <BookmarkSolid className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
                      </button>

                      {(() => {
                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                        const isOwner = user.userId === selectedVideo.userId || user.id === selectedVideo.userId;
                        return !isOwner && (
                          <button
                            onClick={() => handleReportPost(selectedVideo.postId, {
                              title: 'Báo cáo bài viết',
                              content: 'Nội dung vi phạm',
                              category: 'CONTENT',
                              targetType: 'POST',
                            })}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-gray-100 text-yellow-600 hover:bg-gray-200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 p-4">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {selectedVideo.content || ''}
                    </ReactMarkdown>
                  </div>
                </div>

                <div className="border-t border-gray-100 p-4">
                  <h3 className="font-medium mb-4">{selectedVideo.commentsCount || 0} bình luận</h3>
                  <form onSubmit={handleSubmitComment} className="flex items-center space-x-2 mb-6">
                    <Avatar
                      src={getMediaUrl(JSON.parse(localStorage.getItem('user') || '{}').profileImage)}
                      name={JSON.parse(localStorage.getItem('user') || '{}').fullName}
                      size="small"
                    />
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        className="w-full py-2 px-3 border border-gray-300 rounded-full bg-gray-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Viết bình luận..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        disabled={submittingComment}
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 disabled:text-gray-400"
                        disabled={submittingComment || !newComment.trim()}
                      >
                        {submittingComment ? (
                          <div className="w-6 h-6 border-2 border-t-blue-500 border-r-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </form>

                  {isLoadingComments ? (
                    <div className="flex justify-center py-4">
                      <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : commentError ? (
                    <div className="text-center py-4 text-red-500 text-sm">{commentError}</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Chưa có bình luận nào.</div>
                  ) : (
                    <div ref={commentsRef} className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {comments.map(comment => (
                        <div key={comment.commentId} className="flex space-x-2">
                          <Avatar src={getMediaUrl(comment.userImage)} name={comment.fullName} size="small" />
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg px-3 py-2">
                              <div className="font-medium text-sm">{comment.fullName}</div>
                              <div className="text-sm">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                  {comment.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                            <div className="flex items-center mt-1 text-xs text-gray-500 space-x-3">
                              <span>{formatDate(comment.createdAt)}</span>
                              <button
                                className={`font-medium ${comment.isLiked ? 'text-blue-500' : ''}`}
                                onClick={() => handleLikeComment(comment.commentId)}
                              >
                                Thích ({comment.likesCount || 0})
                              </button>
                              {comment.userId === JSON.parse(localStorage.getItem('user') || '{}').userId && (
                                <button className="font-medium text-red-500" onClick={() => handleDeleteComment(comment.commentId, selectedVideo?.postId)}>
                                  Xóa
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-gray-500">Không có bài viết nào được chọn</p>
              </div>
            )}
          </div>

          {/* SIDEBAR - GỢI Ý */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Bài viết gợi ý</h2>
                  <div className="flex gap-2">
                    <button
                      className={`px-3 py-1 rounded ${activeFilter === 'latest' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      onClick={() => setActiveFilter('latest')}
                    >
                      Mới nhất
                    </button>
                    <button
                      className={`px-3 py-1 rounded ${activeFilter === 'trending' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      onClick={() => setActiveFilter('trending')}
                    >
                      Phổ biến
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[600px]">
                {filteredPosts.map(post => (
                  <div
                    key={post.postId}
                    className={`p-3 flex gap-3 cursor-pointer hover:bg-gray-50 ${selectedVideo?.postId === post.postId ? 'bg-blue-50' : ''}`}
                    onClick={() => handleVideoSelect(post)}
                  >
                    <div className="w-1/3">
                      {post.media?.length > 0 ? (
                        <div className="relative pb-[56.25%] h-0">
                          {post.media[0].mediaType === 'video' ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black">
                              <img
                                src={videoThumbnails[post.postId] || getMediaUrl(post.media[0].thumbnailUrl) || getMediaUrl(post.media[0].mediaUrl)}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={getMediaUrl(post.media[0].mediaUrl)}
                              alt="Post media"
                              className="absolute inset-0 w-full h-full object-cover rounded-lg"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-200 rounded-lg w-full pb-[56.25%] relative">
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-2/3">
                      <p className="text-xs text-gray-500">{post.fullName}</p>
                      <div className="font-medium text-sm line-clamp-2 mb-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {post.title || post.content?.substring(0, 60) || 'Không có tiêu đề'}
                        </ReactMarkdown>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <div className="flex items-center mr-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike(post.postId);
                            }}
                            className={`flex items-center ${post.isLiked ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {post.isLiked ? <ThumbUpSolid className="h-4 w-4 mr-1" /> : <HandThumbUpIcon className="h-4 w-4 mr-1" />}
                            <span className={post.isLiked ? 'text-blue-600' : ''}>{post.likesCount || 0}</span>
                          </button>
                        </div>

                        <div className="flex items-center mx-2">
                          <ChatBubbleLeftIcon className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{post.commentsCount || 0}</span>
                        </div>

                        <div className="flex items-center mx-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookmark(post.postId);
                            }}
                            className={`flex items-center ${post.isBookmarked ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {post.isBookmarked ? <BookmarkSolid className="h-4 w-4 mr-1" /> : <BookmarkIcon className="h-4 w-4 mr-1" />}
                            <span className={post.isBookmarked ? 'text-blue-600' : ''}>{post.bookmarksCount || 0}</span>
                          </button>
                        </div>

                        <span className="mx-2 text-gray-400">•</span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Posts;