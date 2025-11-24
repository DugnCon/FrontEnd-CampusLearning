import React, { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Avatar } from '../index';
import { getAllStories, viewStory } from '../../api/storyApi';
import StoryCreate from '../../pages/Story/StoryCreate';

const StoryList = ({ orientation = 'horizontal', showTimeline = false, onStoryEnd, onViewStory }) => {
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedStory, setSelectedStory] = useState(null);
    const [viewingStory, setViewingStory] = useState(false);

    useEffect(() => {
        fetchStories();
    }, []);

    // 🔥 FIX: Thêm hàm xử lý URL media giống Posts component
    const getFullMediaUrl = (mediaUrl) => {
        if (!mediaUrl) return '';
        if (mediaUrl.startsWith('http')) return mediaUrl;
        return `https://campuslearning.site${mediaUrl}`;
    };

    const fetchStories = async () => {
        try {
            setLoading(true);
            const data = await getAllStories();
            setStories(data.stories || []);
        } catch (error) {
            console.error('Fetch stories error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStoryCreated = (newStory) => {
        console.log('New story created:', newStory);
        setStories(prevStories => [newStory, ...prevStories]);
        setShowCreateForm(false);
        fetchStories();
    };

    const handleStoryClick = async (story) => {
        setSelectedStory(story);
        setViewingStory(true);

        if (onViewStory) {
            const storyIndex = stories.findIndex(s => s.storyID === story.storyID);
            if (storyIndex !== -1) {
                onViewStory(storyIndex, stories);
                return;
            }
        }

        try {
            await viewStory(story.storyID);
        } catch (error) {
            console.error('Mark story as viewed error:', error);
        }
    };

    const renderStoryItem = (story) => {
        const fullMediaUrl = getFullMediaUrl(story.mediaUrl);
        
        return (
            <div
                key={story.storyID}
                onClick={() => handleStoryClick(story)}
                className="relative cursor-pointer group"
            >
                <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-200">
                    {story.mediaType === 'image' ? (
                        <img
                            src={fullMediaUrl}
                            alt="Story"
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                                console.error('❌ Story image failed to load:', fullMediaUrl);
                            }}
                        />
                    ) : story.mediaType === 'video' ? (
                        <video
                            src={fullMediaUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            crossOrigin="anonymous"
                            onError={(e) => {
                                console.error('❌ Story video failed to load:', fullMediaUrl);
                            }}
                        >
                            <source src={fullMediaUrl} type="video/mp4" />
                        </video>
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center p-4"
                            style={{ backgroundColor: story.backgroundColor || '#1d4ed8' }}
                        >
                            <p className={`text-white text-center ${story.fontStyle || 'font-sans'}`}>
                                {story.textContent}
                            </p>
                        </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
                    
                    <div className="absolute top-2 left-2 flex items-center">
                        <Avatar
                            src={getFullMediaUrl(story.user?.image)}
                            name={story.user?.fullName}
                            size="small"
                            className="ring-2 ring-white"
                        />
                        <span className="ml-2 text-white text-sm font-medium truncate max-w-[100px]">
                            {story.user?.fullName}
                        </span>
                    </div>
                    
                    <div className="absolute bottom-2 left-2 text-white text-xs">
                        {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Video play icon */}
                    {story.mediaType === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Create Story Form Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg">
                        <StoryCreate
                            onStoryCreated={handleStoryCreated}
                            onClose={() => setShowCreateForm(false)}
                        />
                    </div>
                </div>
            )}

            {/* Story Viewer Modal */}
            {viewingStory && selectedStory && !onViewStory && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                    <button
                        onClick={() => setViewingStory(false)}
                        className="absolute top-4 right-4 text-white text-xl z-10 bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
                    >
                        ×
                    </button>
                    
                    <div className="w-full max-w-lg mx-4">
                        {selectedStory.mediaType === 'image' ? (
                            <img
                                src={getFullMediaUrl(selectedStory.mediaUrl)}
                                alt="Story"
                                className="w-full h-auto max-h-[80vh] object-contain"
                                crossOrigin="anonymous"
                            />
                        ) : selectedStory.mediaType === 'video' ? (
                            <video
                                src={getFullMediaUrl(selectedStory.mediaUrl)}
                                className="w-full h-auto max-h-[80vh]"
                                controls
                                autoPlay
                                playsInline
                                crossOrigin="anonymous"
                            >
                                <source src={getFullMediaUrl(selectedStory.mediaUrl)} type="video/mp4" />
                            </video>
                        ) : (
                            <div
                                className="w-full h-96 flex items-center justify-center p-8 rounded-lg"
                                style={{ backgroundColor: selectedStory.backgroundColor || '#1d4ed8' }}
                            >
                                <p className={`text-white text-2xl text-center ${selectedStory.fontStyle || 'font-sans'}`}>
                                    {selectedStory.textContent}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stories Grid */}
            <div className={`grid gap-4 ${
                orientation === 'horizontal' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}>
                {/* Create Story Button */}
                <div
                    onClick={() => setShowCreateForm(true)}
                    className="relative cursor-pointer group"
                >
                    <div className="w-full h-40 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300">
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                <PlusIcon className="w-6 h-6 text-white" />
                            </div>
                            <span className="mt-2 text-sm font-medium text-gray-700">
                                Tạo story
                            </span>
                        </div>
                    </div>
                </div>

                {/* Story Items */}
                {loading ? (
                    <div className="text-center py-4 col-span-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                ) : (
                    stories.map(story => renderStoryItem(story))
                )}

                {/* Empty State */}
                {!loading && stories.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                        Chưa có story nào. Hãy tạo story đầu tiên!
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoryList;