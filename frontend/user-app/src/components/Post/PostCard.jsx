/*-----------------------------------------------------------------
* File: PostCard.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useEffect } from 'react';
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
  Alert
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
import useComments from '../../hooks/useComments';

const CommentItem = ({ comment, onLike, onDelete }) => {
  const formatTime = (date) => {
    return new Date(date).toLocaleString();
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser.userID === comment.userID || currentUser.id === comment.userID;

  return (
    <ListItem alignItems="flex-start" sx={{ py: 1 }}>
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
                onClick={() => onLike(comment.commentID)}
                sx={{ minWidth: 'auto', mr: 1 }}
              >
                {comment.likesCount}
              </Button>
              {isOwner && (
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

const CommentForm = ({ postId, onCommentAdded }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

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

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', mt: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Viết bình luận..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
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
  const { 
    comments, 
    isLoading, 
    error, 
    fetchComments, 
    addComment,
    likeComment,
    deleteComment
  } = useComments({
    onUpdatePost: onComment
  });

  const formatTime = (date) => {
    return new Date(date).toLocaleString();
  };

  const handleExpandClick = () => {
    if (!expanded) {
      fetchComments(post.PostID);
    }
    setExpanded(!expanded);
  };

  const handleCommentAdded = async (content) => {
    try {
      await addComment(post.postID, content);
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const handleLikeComment = async (commentId) => {
    await likeComment(commentId);
  };

  const handleDeleteComment = async (commentId) => {
    await deleteComment(commentId, post.postID);
  };

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
      await onShare(post.PostID, { shareType: 'copy' });
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
            </List>
          )}
          <CommentForm postId={post.postID} onCommentAdded={handleCommentAdded} />
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
    </Card>
  );
};

export default PostCard; 
