import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../index';
import { TrashIcon, EyeIcon, UserGroupIcon, HeartIcon, ChatBubbleLeftIcon, XMarkIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { viewStory, getStoryViewers, likeStory, replyToStory } from '../../api/storyApi';
import './Story.css';

const Story = ({ story, onClose, onNext, onPrevious, onDelete, viewCount }) => {
    const [progress, setProgress] = useState(0);
    const [viewers, setViewers] = useState([]);
    const [showViewers, setShowViewers] = useState(false);
    const [loadingViewers, setLoadingViewers] = useState(false);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // 🔥 THÊM STATE CHO ÂM THANH
    const progressRef = useRef(null);
    const videoRef = useRef(null); // 🔥 THÊM REF CHO VIDEO
    const navigate = useNavigate();
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    onNext?.();
                    return 100;
                }
                return prev + (100 / (story.duration || 15));
            });
        }, 1000);

        // Mark story as viewed using the API service
        const markAsViewed = async () => {
            try {
                await viewStory(story.storyID);
            } catch (error) {
                console.error('Error marking story as viewed:', error);
            }
        };

        markAsViewed();

        return () => clearInterval(timer);
    }, [story.storyID, story.duration, onNext]);

    // 🔥 THÊM useEffect ĐỂ XỬ LÝ VIDEO
    useEffect(() => {
        if (story.mediaType === 'video' && videoRef.current) {
            console.log('🎬 Video element ready');
            console.log('🔊 Muted state:', videoRef.current.muted);
            console.log('📢 Volume:', videoRef.current.volume);
            
            // Thử bật âm thanh sau 1 giây
            const timeout = setTimeout(() => {
                if (videoRef.current && isMuted) {
                    videoRef.current.muted = false;
                    setIsMuted(false);
                    console.log('🔊 Attempting to unmute video');
                }
            }, 1000);

            return () => clearTimeout(timeout);
        }
    }, [story.mediaType, isMuted]);

    // 🔥 THÊM HÀM TOGGLE ÂM THANH
    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
            console.log('🔊 Toggle mute:', videoRef.current.muted);
        }
    };

    // 🔥 THÊM HÀM XỬ LÝ VIDEO LOAD
    const handleVideoLoad = () => {
        console.log('🎬 Video loaded successfully');
        if (videoRef.current) {
            console.log('📺 Video duration:', videoRef.current.duration);
            console.log('🔊 Initial muted state:', videoRef.current.muted);
            
            // Auto-play với âm thanh sau khi user tương tác
            videoRef.current.play().catch(error => {
                console.log('Auto-play prevented, waiting for user interaction');
            });
        }
    };

    // 🔥 THÊM HÀM XỬ LÝ VIDEO ERROR
    const handleVideoError = (e) => {
        console.error('❌ Video error:', e);
        console.log('📹 Video src:', e.target.src);
    };

    const handleClick = (e) => {
        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = (x / width) * 100;
        setProgress(percentage);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight') {
            onNext?.();
        } else if (e.key === 'ArrowLeft') {
            onPrevious?.();
        } else if (e.key === 'Escape') {
            if (showReplyModal) {
                setShowReplyModal(false);
            } else {
                onClose();
            }
        } else if (e.key === 'm' || e.key === 'M') { // 🔥 THÊM PHÍM TẮT MUTE
            toggleMute();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrevious, onClose, showReplyModal]);
    
    const fetchViewers = async () => {
        if (showViewers) {
            setShowViewers(false);
            return;
        }
        
        try {
            setLoadingViewers(true);
            const response = await getStoryViewers(story.storyID);
            setViewers(response.viewers || []);
            setShowViewers(true);
        } catch (error) {
            console.error('Error fetching viewers:', error);
        } finally {
            setLoadingViewers(false);
        }
    };
    
    const handleLike = async () => {
        try {
            const res = await likeStory(story.storyID);
            if (res.liked) {
                setLiked(true);
            }
        } catch (error) {
            console.error('Error liking story:', error);
        }
    };

    const handleReplyClick = () => {
        setShowReplyModal(true);
    };

    const handleCloseReplyModal = () => {
        setShowReplyModal(false);
        setReplyMessage('');
    };

    const handleSendReply = async () => {
        if (!replyMessage.trim()) return;
        
        setSendingReply(true);
        try {
            console.log('🔄 Sending reply to story:', story.storyID);
            console.log('📝 Message:', replyMessage);

            const response = await replyToStory(story.storyID, replyMessage);
            console.log('✅ Response:', response);
            
            alert('Tin nhắn đã được gửi!');
            setShowReplyModal(false);
            setReplyMessage('');
            navigate('/chat');
            
        } catch (error) {
            console.error('❌ Error sending reply:', error);
            
            if (error.response) {
                console.log('🔴 BACKEND ERROR DETAILS:');
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data);
                
                const errorMessage = error.response.data?.message || 'Lỗi không xác định';
                alert(`Lỗi: ${errorMessage}`);
            } else {
                alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
            }
        } finally {
            setSendingReply(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSendReply();
        }
    };

    // Render story preview for reply modal
    const renderStoryPreview = () => {
        if (story.mediaType === 'image') {
            return (
                <img 
                    src={story.mediaUrl} 
                    alt="Story preview" 
                    className="story-reply-preview-image"
                />
            );
        } else if (story.mediaType === 'video') {
            return (
                <video 
                    src={story.mediaUrl} 
                    className="story-reply-preview-video"
                    muted={isMuted}
                    autoPlay
                    loop
                    ref={videoRef}
                />
            );
        } else {
            return (
                <div 
                    className="story-reply-preview-text"
                    style={{ backgroundColor: story.backgroundColor }}
                >
                    <p style={{ 
                        color: 'white', 
                        fontSize: '18px',
                        fontFamily: story.fontStyle || 'inherit',
                        fontWeight: '600'
                    }}>
                        {story.textContent}
                    </p>
                </div>
            );
        }
    };

    const isOwnStory = onDelete !== null;

    return (
        <div className="story-container">
            <div className="story-header">
                <div className="story-user-info">
                    <Avatar
                        src={story.user?.image}
                        name={story.user?.fullName}
                        size="small"
                        className="ring-2 ring-white"
                    />
                    <span className="story-username">{story.user?.fullName}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {/* 🔥 THÊM NÚT ÂM THANH CHO VIDEO */}
                    {story.mediaType === 'video' && (
                        <button 
                            className="story-mute-btn"
                            onClick={toggleMute}
                            aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                        >
                            {isMuted ? (
                                <SpeakerXMarkIcon className="w-5 h-5 text-white" />
                            ) : (
                                <SpeakerWaveIcon className="w-5 h-5 text-white" />
                            )}
                        </button>
                    )}
                    {onDelete && (
                        <button 
                            className="story-delete-btn" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            aria-label="Xóa story"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                    <button className="story-close-btn" onClick={onClose}>×</button>
                </div>
            </div>

            <div className="story-progress-container" ref={progressRef} onClick={handleClick}>
                <div 
                    className="story-progress-bar"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <div className="story-content" style={{ backgroundColor: story.backgroundColor }}>
                {story.mediaType === 'image' && (
                    <img 
                        src={story.mediaUrl} 
                        alt="Story" 
                        className="story-media"
                    />
                )}
                {story.mediaType === 'video' && (
                    <div className="story-video-container">
                        <video 
                            ref={videoRef}
                            src={story.mediaUrl} 
                            className="story-media"
                            autoPlay
                            loop
                            muted={isMuted} // 🔥 SỬA: DÙNG STATE THAY VÌ MUTED CỨNG
                            playsInline
                            onLoadedData={handleVideoLoad}
                            onError={handleVideoError}
                            onPlay={() => console.log('🎬 Video started playing')}
                            onVolumeChange={() => console.log('🔊 Volume changed:', videoRef.current?.volume)}
                        />
                        {/* 🔥 THÊM THÔNG BÁO ÂM THANH */}
                        {isMuted && (
                            <div className="story-mute-indicator">
                                <SpeakerXMarkIcon className="w-6 h-6" />
                                <span>Nhấn M để bật âm thanh</span>
                            </div>
                        )}
                    </div>
                )}
                {story.textContent && (
                    <div className="story-text">
                        {story.textContent}
                    </div>
                )}
            </div>

            <div className="story-footer">
                <div className="story-footer-content">
                    {isOwnStory ? (
                        <>
                            <button 
                                className="story-viewers-btn"
                                onClick={fetchViewers}
                                disabled={loadingViewers}
                            >
                                {loadingViewers ? (
                                    <span className="loading-spinner"></span>
                                ) : (
                                    <>
                                        <UserGroupIcon className="w-4 h-4 mr-1" />
                                        <span>Người xem</span>
                                    </>
                                )}
                            </button>
                            <div className="story-view-count">
                                <EyeIcon className="w-4 h-4 mr-1" />
                                <span>{viewCount}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <button className="story-like-btn" onClick={handleLike} aria-label="Thả tim">
                                <HeartIcon className="w-4 h-4" />
                            </button>
                            <button className="story-reply-btn" onClick={handleReplyClick} aria-label="Trả lời story">
                                <ChatBubbleLeftIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
                
                {/* Viewers list */}
                {showViewers && (
                    <div className="story-viewers-list">
                        <div className="story-viewers-header">
                            <h4>Người xem ({viewers.length})</h4>
                            <button onClick={() => setShowViewers(false)}>×</button>
                        </div>
                        <div className="story-viewers-content">
                            {viewers.length > 0 ? (
                                viewers.map((viewer) => (
                                    <div key={viewer.viewID} className="story-viewer-item">
                                        <Avatar
                                            src={viewer.viewer?.image}
                                            name={viewer.viewer?.fullName}
                                            size="small"
                                        />
                                        <div className="story-viewer-info">
                                            <span className="story-viewer-name">{viewer.viewer?.fullName}</span>
                                            <span className="story-viewer-time">
                                                {new Date(viewer.viewedAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-viewers">Chưa có người xem</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Story Reply Modal */}
            {showReplyModal && (
                <div className="story-reply-modal">
                    <div className="story-reply-backdrop" onClick={handleCloseReplyModal} />
                    
                    <div className="story-reply-container">
                        {/* Story Preview Background */}
                        <div className="story-reply-preview">
                            {renderStoryPreview()}
                            
                            {/* User Info Overlay */}
                            <div className="story-reply-user-info">
                                <Avatar
                                    src={story.user?.image}
                                    name={story.user?.fullName}
                                    size="small"
                                    className="ring-2 ring-white"
                                />
                                <span className="story-reply-username">
                                    {story.user?.fullName}
                                </span>
                            </div>
                            
                            {/* Close Button */}
                            <button 
                                className="story-reply-close"
                                onClick={handleCloseReplyModal}
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Reply Input Area */}
                        <div className="story-reply-input-container">
                            <textarea
                                className="story-reply-input"
                                placeholder="Nhập tin nhắn trả lời..."
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                maxLength={500}
                                autoFocus
                                rows={3}
                            />
                            
                            <div className={`story-reply-counter ${replyMessage.length > 450 ? 'warning' : ''}`}>
                                {replyMessage.length}/500
                            </div>
                            
                            <div className="story-reply-actions">
                                <button 
                                    className="story-reply-cancel"
                                    onClick={handleCloseReplyModal}
                                    disabled={sendingReply}
                                >
                                    Hủy
                                </button>
                                <button 
                                    className="story-reply-send"
                                    onClick={handleSendReply}
                                    disabled={!replyMessage.trim() || sendingReply}
                                >
                                    {sendingReply ? 'Đang gửi...' : 'Gửi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="story-navigation">
                <button className="story-nav-btn story-nav-prev" onClick={onPrevious} />
                <button className="story-nav-btn story-nav-next" onClick={onNext} />
            </div>
        </div>
    );
};

export default Story;