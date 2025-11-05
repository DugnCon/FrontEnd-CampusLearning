import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import CommentIcon from '@mui/icons-material/Comment';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import ReportIcon from '@mui/icons-material/Report';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSocket } from '../../contexts/SocketContext';
import { commentApi } from '../../api/commentApi';

const CommentItem = ({ comment, onLike, onDelete }) => {
  const formatTime = (date) => {
    return new Date(date).toLocaleString();
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser.userID === comment.userID || currentUser.id === comment.userID;

  return (
    <ListItem 
      alignItems="flex-start" 
      sx={{ 
        py: 1,
        opacity: comment.isTemp ? 0.7 : 1 // Làm mờ temporary comments
      }}
    >
      <ListItemAvatar>
        <Avatar src={comment.userImage} alt={comment.fullName}>
          {comment.fullName ? comment.fullName[0] : 'U'}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" component="span">
              {comment.fullName}
              {comment.isTemp && (
                <Typography 
                  component="span" 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  (Đang gửi...)
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(comment.createdAt)}
            </Typography>
          </Box>
        }
        secondary={
          <Box>
            <Typography
              component="span"
              variant="body2"
              color="text.primary"
              sx={{ display: 'block', my: 0.5 }}
            >
              {comment.content}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Button 
                size="small" 
                startIcon={<ThumbUpIcon fontSize="small" />}
                color={comment.isLiked ? "primary" : "inherit"}
                onClick={() => !comment.isTemp && onLike(comment.commentID)}
                disabled={comment.isTemp} // Disable like cho temporary comments
                sx={{ minWidth: 'auto', mr: 1 }}
              >
                {comment.likesCount}
              </Button>
              {isOwner && !comment.isTemp && (
                <Button
                  size="small"
                  startIcon={<DeleteIcon fontSize="small" />}
                  color="inherit"
                  onClick={() => onDelete(comment.commentID)}
                  sx={{ minWidth: 'auto' }}
                >
                  Xóa
                </Button>
              )}
            </Box>
          </Box>
        }
      />
    </ListItem>
  );
};

const CommentForm = ({ postId, onCommentAdded, onTyping }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setComment(value);
    
    // Send typing indicator
    if (value.trim().length > 0 && !isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setIsSubmitting(true);
    try {
      await onCommentAdded(comment);
      setComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        onTyping(false);
      }
    };
  }, [isTyping, onTyping]);

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', mt: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Viết bình luận..."
        value={comment}
        onChange={handleInputChange}
        disabled={isSubmitting}
        variant="outlined"
      />
      <Button 
        type="submit" 
        disabled={!comment.trim() || isSubmitting}
        sx={{ ml: 1 }}
        variant="contained"
      >
        {isSubmitting ? <CircularProgress size={24} /> : <SendIcon />}
      </Button>
    </Box>
  );
};

const PostCard = ({ post, onLike, onComment, onDelete, onReport, onShare }) => {
  const [expanded, setExpanded] = useState(false);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [reportCategory, setReportCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  
  // State for comments với WebSocket
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Socket
  const { isConnected, subscribe, unsubscribe, sendMessage } = useSocket();
  
  // Refs
  const commentsEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const formatTime = (date) => {
    return new Date(date).toLocaleString();
  };

  // Auto scroll to bottom khi có comment mới
  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (comments.length > 0) {
      scrollToBottom();
    }
  }, [comments.length]);

  // Fetch comments từ API
  const fetchComments = async (postId) => {
    if (!postId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await commentApi.getComments(postId);
      if (response.success) {
        setComments(response.data || []);
      } else {
        setError(response.message || 'Failed to load comments');
      }
    } catch (err) {
      setError('Error loading comments');
      console.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // WebSocket subscription
  useEffect(() => {
    if (!isConnected || !post?.postID || !expanded) return;

    const commentDestination = `/topic/post.${post.postID}.comments`;
    const typingDestination = `/topic/post.${post.postID}.typing`;
    const onlineDestination = `/topic/post.${post.postID}.online`;

    console.log('🎯 Subscribing to post comments:', commentDestination);

    // Subscribe to new comments
    const commentSub = subscribe(commentDestination, (data) => {
      console.log('📨 Received comment update:', data);
      
      switch (data.type) {
        case 'NEW_COMMENT':
          handleNewComment(data.data);
          break;
        case 'COMMENT_LIKED':
          handleCommentLiked(data.data);
          break;
        case 'COMMENT_DELETED':
          handleCommentDeleted(data.data);
          break;
        case 'TYPING':
          handleCommentTyping(data.data);
          break;
        default:
          console.log('Unknown comment event:', data.type);
      }
    });

    // Subscribe to typing indicators
    const typingSub = subscribe(typingDestination, (data) => {
      if (data.type === 'TYPING') {
        handleCommentTyping(data.data);
      }
    });

    // Subscribe to online users
    const onlineSub = subscribe(onlineDestination, (data) => {
      if (data.type === 'USER_JOINED') {
        setOnlineUsers(prev => [...prev.filter(u => u.userId !== data.userId), data]);
      } else if (data.type === 'USER_LEFT') {
        setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    });

    // Join the post room
    sendMessage('/post.join', { postId: post.postID });

    return () => {
      console.log('🗑️ Unsubscribing from post comments');
      if (commentSub) unsubscribe(commentDestination);
      if (typingSub) unsubscribe(typingDestination);
      if (onlineSub) unsubscribe(onlineDestination);
    };
  }, [isConnected, post?.postID, expanded, subscribe, unsubscribe, sendMessage]);

  // WebSocket handlers
  const handleNewComment = useCallback((commentData) => {
    console.log('➕ Adding new comment via WebSocket:', commentData);
    
    setComments(prev => {
      // Kiểm tra xem comment đã tồn tại chưa (tránh trùng khi tự gửi)
      const exists = prev.some(comment => 
        comment.commentID === commentData.commentID || 
        (comment.isTemp && comment.content === commentData.content)
      );
      
      if (!exists) {
        // Nếu đang có temporary comment với cùng content, thay thế nó
        const tempCommentIndex = prev.findIndex(comment => 
          comment.isTemp && comment.content === commentData.content
        );
        
        if (tempCommentIndex !== -1) {
          const newComments = [...prev];
          newComments[tempCommentIndex] = { ...commentData, isTemp: false };
          return newComments;
        }
        
        return [commentData, ...prev];
      }
      return prev;
    });

    // Chỉ update count nếu không phải comment của chính mình
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isOwnComment = currentUser.userID === commentData.userID || currentUser.id === commentData.userID;
    
    if (!isOwnComment && onComment) {
      onComment(post.postID, prevCount => prevCount + 1);
    }
  }, [post?.postID, onComment]);

  const handleCommentLiked = useCallback((data) => {
    setComments(prev =>
      prev.map(comment =>
        comment.commentID === data.commentId
          ? {
              ...comment,
              likesCount: data.likesCount,
              isLiked: data.isLiked
            }
          : comment
      )
    );
  }, []);

  const handleCommentDeleted = useCallback((data) => {
    setComments(prev =>
      prev.filter(comment => comment.commentID !== data.commentId)
    );
    
    // Update post comments count
    if (onComment) {
      onComment(post.postID, prevCount => Math.max(0, prevCount - 1));
    }
  }, [post?.postID, onComment]);

  const handleCommentTyping = useCallback((data) => {
    const { userId, username, isTyping } = data;
    
    setTypingUsers(prev => {
      if (isTyping) {
        // Add user to typing list
        const userExists = prev.some(user => user.userId === userId);
        if (!userExists) {
          return [...prev, { userId, username }];
        }
        return prev;
      } else {
        // Remove user from typing list
        return prev.filter(user => user.userId !== userId);
      }
    });
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping) => {
    if (!isConnected || !post?.postID) return;

    sendMessage('/post.typing', {
      postId: post.postID,
      isTyping
    });
  }, [isConnected, post?.postID, sendMessage]);

  const handleExpandClick = () => {
    if (!expanded && post?.postID) {
      // Đảm bảo comments được fetch sau khi WebSocket đã subscribe
      setTimeout(() => {
        fetchComments(post.postID);
      }, 100);
    }
    setExpanded(!expanded);
  };

  const handleCommentAdded = async (content) => {
    try {
      // Tạo temporary ID ngay lập tức để optimistic update
      const tempCommentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Tạo temporary comment object
      const tempComment = {
        commentID: tempCommentId,
        content: content,
        fullName: currentUser.fullName || currentUser.username || 'User',
        userImage: currentUser.avatar || currentUser.profileImage || currentUser.image,
        userID: currentUser.userID || currentUser.id,
        likesCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        isTemp: true // Flag để nhận biết comment tạm thời
      };

      // OPTIMISTIC UPDATE - Thêm comment ngay lập tức vào UI
      setComments(prev => [tempComment, ...prev]);
      
      // Update comments count locally
      if (onComment) {
        onComment(post.postID, prevCount => prevCount + 1);
      }

      // Gọi API
      const response = await commentApi.addComment(post.postID, content);
      
      if (response.success) {
        const newComment = response.data;
        
        if (newComment) {
          // Thay thế temporary comment bằng comment thật từ server
          setComments(prev => 
            prev.map(comment => 
              comment.commentID === tempCommentId 
                ? { ...newComment, isTemp: false } 
                : comment
            )
          );
          
          console.log('✅ Comment replaced with server data:', newComment);
        }
      } else {
        // Nếu API fail, xóa temporary comment
        setComments(prev => prev.filter(comment => comment.commentID !== tempCommentId));
        if (onComment) {
          onComment(post.postID, prevCount => Math.max(0, prevCount - 1));
        }
        throw new Error(response.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      // OPTIMISTIC UPDATE - cập nhật UI ngay lập tức
      setComments(prev =>
        prev.map(comment => {
          if (comment.commentID === commentId) {
            const wasLiked = comment.isLiked;
            return {
              ...comment,
              likesCount: wasLiked ? comment.likesCount - 1 : comment.likesCount + 1,
              isLiked: !wasLiked
            };
          }
          return comment;
        })
      );

      const response = await commentApi.likeComment(commentId);
      
      if (!response.success) {
        // Revert nếu API fail
        setComments(prev =>
          prev.map(comment => {
            if (comment.commentID === commentId) {
              const wasLiked = comment.isLiked;
              return {
                ...comment,
                likesCount: wasLiked ? comment.likesCount + 1 : comment.likesCount - 1,
                isLiked: !wasLiked
              };
            }
            return comment;
          })
        );
        throw new Error(response.message || 'Failed to like comment');
      }
      
      console.log('✅ Comment liked with optimistic update');
    } catch (err) {
      console.error('Error liking comment:', err);
      throw err;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      // OPTIMISTIC UPDATE - xóa ngay khỏi UI
      const deletedComment = comments.find(comment => comment.commentID === commentId);
      setComments(prev => prev.filter(comment => comment.commentID !== commentId));
      
      // Update count locally
      if (onComment) {
        onComment(post.postID, prevCount => Math.max(0, prevCount - 1));
      }

      const response = await commentApi.deleteComment(commentId);
      
      if (!response.success) {
        // Revert nếu API fail
        setComments(prev => [...prev, deletedComment]);
        if (onComment) {
          onComment(post.postID, prevCount => prevCount + 1);
        }
        throw new Error(response.message || 'Failed to delete comment');
      }
      
      console.log('✅ Comment deleted with optimistic update');
    } catch (err) {
      console.error('Error deleting comment:', err);
      throw err;
    }
  };

  const handleTypingIndicator = (isTyping) => {
    sendTypingIndicator(isTyping);
  };

  // Format typing text
  const typingText = typingUsers.length > 0 
    ? `${typingUsers.map(user => user.username).join(', ')} ${typingUsers.length === 1 ? 'đang' : 'đang'} gõ...`
    : '';

  const handleReportSubmit = async () => {
    if (!reportTitle.trim() || !reportContent.trim() || !reportCategory) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onReport(post.postID, {
        title: reportTitle,
        content: reportContent,
        category: reportCategory,
        targetType: 'POST'
      });
      setOpenReportDialog(false);
      setReportTitle('');
      setReportContent('');
      setReportCategory('');
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async (shareType, sharePlatform) => {
    try {
      await onShare(post.postID, { shareType, sharePlatform });
      setShareSuccess(true);
      setShareMessage('Chia sẻ bài viết thành công!');
      setOpenShareDialog(false);
    } catch (error) {
      console.error('Error sharing post:', error);
      setShareError(true);
      setShareMessage('Không thể chia sẻ bài viết. Vui lòng thử lại sau.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const postUrl = `${window.location.origin}/posts?postId=${post.postID}`;
      await navigator.clipboard.writeText(postUrl);
      await onShare(post.postID, { shareType: 'copy' });
      setShareSuccess(true);
      setShareMessage('Đã sao chép liên kết vào clipboard!');
      setOpenShareDialog(false);
    } catch (error) {
      console.error('Error copying link:', error);
      setShareError(true);
      setShareMessage('Không thể sao chép liên kết. Vui lòng thử lại sau.');
    }
  };

  const handleCloseSnackbar = () => {
    setShareSuccess(false);
    setShareError(false);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        avatar={
          <Avatar src={post.userImage} alt={post.fullName}>
            {post.fullName ? post.fullName[0] : 'U'}
          </Avatar>
        }
        action={
          <IconButton>
            <MoreVertIcon />
          </IconButton>
        }
        title={post.fullName}
        subheader={formatTime(post.createdAt)}
      />

      <CardContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {post.content}
        </Typography>

        {post.media && post.media.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {post.media.map((media, index) => (
              media.mediaType === 'image' ? (
                <Box
                  key={index}
                  component="img"
                  src={media.mediaUrl}
                  sx={{ 
                    maxWidth: '100%',
                    maxHeight: 400,
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <Box
                  key={index}
                  component="video"
                  src={media.mediaUrl}
                  controls
                  sx={{ 
                    maxWidth: '100%',
                    maxHeight: 400
                  }}
                />
              )
            ))}
          </Box>
        )}
      </CardContent>

      <CardActions disableSpacing>
        <IconButton 
          onClick={() => onLike(post.postID)}
          color={post.isLiked ? "primary" : "default"}
        >
          <ThumbUpIcon />
        </IconButton>
        <Typography variant="body2" sx={{ mr: 2 }}>
          {post.likesCount}
        </Typography>

        <IconButton onClick={handleExpandClick}>
          <CommentIcon color={expanded ? "primary" : "default"} />
        </IconButton>
        <Typography variant="body2" sx={{ mr: 2 }}>
          {post.commentsCount}
        </Typography>

        <IconButton onClick={() => setOpenShareDialog(true)}>
          <ShareIcon />
        </IconButton>
        <Typography variant="body2" sx={{ mr: 2 }}>
          {post.sharesCount}
        </Typography>

        {(() => {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const isOwner = currentUser.userID === post.userID || currentUser.id === post.userID;
          
          return isOwner ? (
            <IconButton 
              color="error"
              onClick={() => onDelete(post.postID)}
              sx={{ ml: 'auto' }}
            >
              <DeleteIcon />
            </IconButton>
          ) : (
            <IconButton 
              color="warning"
              onClick={() => setOpenReportDialog(true)}
              sx={{ ml: 'auto' }}
            >
              <ReportIcon />
            </IconButton>
          );
        })()}
      </CardActions>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent>
          {/* Real-time Indicators */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Bình luận</Typography>
            
            {/* Real-time indicators */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {onlineUsers.length > 0 && (
                <Chip 
                  size="small" 
                  label={`${onlineUsers.length} online`} 
                  color="success" 
                  variant="outlined" 
                />
              )}
              {isConnected && (
                <Chip 
                  size="small" 
                  icon={<div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50' }} />}
                  label="Live" 
                  color="success" 
                  variant="outlined" 
                />
              )}
            </Box>
          </Box>

          {/* Typing Indicator */}
          {typingText && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}
            >
              {typingText}
            </Typography>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error">Error loading comments</Typography>
          ) : (
            <List>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.commentID}
                  comment={comment}
                  onLike={handleLikeComment}
                  onDelete={handleDeleteComment}
                />
              ))}
              <div ref={commentsEndRef} />
            </List>
          )}
          <CommentForm 
            postId={post.postID} 
            onCommentAdded={handleCommentAdded}
            onTyping={handleTypingIndicator}
          />
        </CardContent>
      </Collapse>

      {/* Report Dialog */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Báo cáo bài viết</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tiêu đề"
            fullWidth
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            select
            margin="dense"
            label="Loại báo cáo"
            fullWidth
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
            disabled={isSubmitting}
          >
            <MenuItem value="CONTENT">Nội dung không phù hợp</MenuItem>
            <MenuItem value="USER">Người dùng vi phạm</MenuItem>
            <MenuItem value="COMMENT">Bình luận vi phạm</MenuItem>
            <MenuItem value="EVENT">Sự kiện vi phạm</MenuItem>
            <MenuItem value="COURSE">Khóa học vi phạm</MenuItem>
          </TextField>
          <TextField
            margin="dense"
            label="Nội dung báo cáo"
            fullWidth
            multiline
            rows={4}
            value={reportContent}
            onChange={(e) => setReportContent(e.target.value)}
            disabled={isSubmitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button 
            onClick={handleReportSubmit} 
            variant="contained" 
            color="warning"
            disabled={isSubmitting || !reportTitle.trim() || !reportContent.trim() || !reportCategory}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Gửi báo cáo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={openShareDialog} onClose={() => setOpenShareDialog(false)}>
        <DialogTitle>Chia sẻ bài viết</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <Button
              variant="outlined"
              startIcon={<FacebookIcon />}
              onClick={() => handleShare('link', 'facebook')}
              fullWidth
            >
              Chia sẻ lên Facebook
            </Button>
            <Button
              variant="outlined"
              startIcon={<TwitterIcon />}
              onClick={() => handleShare('link', 'twitter')}
              fullWidth
            >
              Chia sẻ lên Twitter
            </Button>
            <Button
              variant="outlined"
              startIcon={<WhatsAppIcon />}
              onClick={() => handleShare('link', 'whatsapp')}
              fullWidth
            >
              Chia sẻ qua WhatsApp
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyLink}
              fullWidth
            >
              Sao chép liên kết
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShareDialog(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for share notifications */}
      <Snackbar 
        open={shareSuccess || shareError} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={shareSuccess ? "success" : "error"}
          sx={{ width: '100%' }}
        >
          {shareMessage}
        </Alert>
      </Snackbar>

      {/* Socket Connection Status */}
      {!isConnected && (
        <Box sx={{ p: 1, bgcolor: 'warning.light', textAlign: 'center' }}>
          <Typography variant="caption" color="warning.dark">
            🔄 Đang kết nối...
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default PostCard;