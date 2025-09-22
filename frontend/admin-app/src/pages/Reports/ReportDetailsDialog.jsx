/*-----------------------------------------------------------------
* File: ReportDetailsDialog.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the admin application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Chip,
  Divider,
  Box,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getReportedContent } from '../../api/reports';

/**
 * Report Details Dialog Component
 * Displays the full details of a report and provides action buttons
 */
const ReportDetailsDialog = ({ open, onClose, report, onAction }) => {
  // State for target post content
  const [targetPost, setTargetPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(false);
  const [postError, setPostError] = useState(null);

  // Fetch reported post content when dialog opens
  useEffect(() => {
    if (open && report?.targetType === 'CONTENT') {
      const fetchPost = async () => {
        setLoadingPost(true);
        setPostError(null);
        try {
          const response = await getReportedContent(report.id);
          setTargetPost(response.data.post);
        } catch (error) {
          console.error('Error loading reported post:', error);
          setPostError('Không thể tải nội dung bài viết');
        } finally {
          setLoadingPost(false);
        }
      };
      fetchPost();
    } else {
      setTargetPost(null);
      setPostError(null);
    }
  }, [open, report]);

  if (!report) return null;
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Chi tiết báo cáo #{report.id}
        <Chip 
          label={
            report.status === 'PENDING' ? 'Đang xử lý' : 
            report.status === 'RESOLVED' ? 'Đã giải quyết' : 'Đã từ chối'
          } 
          color={
            report.status === 'PENDING' ? 'warning' : 
            report.status === 'RESOLVED' ? 'success' : 'error'
          }
          size="small"
          sx={{ ml: 1 }}
        />
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6">{report.title}</Typography>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">Loại báo cáo</Typography>
            <Typography variant="body1" gutterBottom>
              <Chip label={report.category} size="small" />
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">Ngày báo cáo</Typography>
            <Typography variant="body1" gutterBottom>{formatDate(report.createdAt)}</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">Người báo cáo</Typography>
            <Typography variant="body1" gutterBottom>{report.reporterName || 'Ẩn danh'}</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" color="text.secondary">Đối tượng bị báo cáo</Typography>
            <Typography variant="body1" gutterBottom>
              {report.targetType}: ID {report.targetID}
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">Nội dung báo cáo</Typography>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mt: 1 }}>
              <Typography variant="body1">{report.content}</Typography>
            </Box>
          </Grid>
          
          {report.targetType === 'CONTENT' && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Nội dung bài viết được báo cáo</Typography>
              {loadingPost ? (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <CircularProgress size={20} />
                  <Typography sx={{ ml: 1 }}>Đang tải bài viết...</Typography>
                </Box>
              ) : postError ? (
                <Typography color="error">{postError}</Typography>
              ) : targetPost ? (
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mt: 1 }}>
                  <Typography variant="body1">{targetPost.content || targetPost.Content}</Typography>
                </Box>
              ) : null}
            </Grid>
          )}
          
          {report.status !== 'PENDING' && (
            <>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Ngày xử lý</Typography>
                <Typography variant="body1" gutterBottom>{formatDate(report.resolvedAt)}</Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Ghi chú xử lý</Typography>
                <Typography variant="body1">{report.notes || 'Không có ghi chú'}</Typography>
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      
      <DialogActions>
        {report.status === 'PENDING' && (
          <>
            <Button 
              onClick={() => onAction('approve')} 
              color="success"
              startIcon={<CheckCircleIcon />}
            >
              Chấp thuận
            </Button>
            <Button 
              onClick={() => onAction('reject')} 
              color="error"
              startIcon={<CancelIcon />}
            >
              Từ chối
            </Button>
            {report.targetType === 'CONTENT' && (
              <>
                <Button 
                  onClick={() => onAction('delete-content')} 
                  color="error"
                  startIcon={<DeleteIcon />}
                >
                  Xóa nội dung
                </Button>
                <Button 
                  onClick={() => onAction('flag-content')} 
                  color="warning"
                  startIcon={<FlagIcon />}
                >
                  Gắn cờ vi phạm
                </Button>
              </>
            )}
          </>
        )}
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
};

ReportDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  report: PropTypes.object,
  onAction: PropTypes.func.isRequired
};

export default ReportDetailsDialog; 
