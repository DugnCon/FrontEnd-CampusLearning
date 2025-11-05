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

    // 🔥 QUAN TRỌNG: Thêm hàm này để xử lý khi story được tạo
    const handleStoryCreated = (newStory) => {
        console.log('New story created:', newStory);
        setStories(prevStories => [newStory, ...prevStories]);
        setShowCreateForm(false);
        
        // Refresh stories list
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

    const renderStoryItem = (story) => (
        <div
            key={story.storyID}
            onClick={() => handleStoryClick(story)}
            className="relative cursor-pointer group"
        >
            <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {story.mediaType === 'image' ? (
                    <img
                        src={story.mediaUrl}
                        alt="Story"
                        className="w-full h-full object-cover"
                    />
                ) : story.mediaType === 'video' ? (
                    <video
                        src={story.mediaUrl}
                        className="w-full h-full object-cover"
                    />
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
                        src={story.user?.image}
                        name={story.user?.fullName}
                        size="small"
                        className="ring-2 ring-white"
                    />
                    <span className="ml-2 text-white text-sm font-medium truncate">
                        {story.user?.fullName}
                    </span>
                </div>
                
                <div className="absolute bottom-2 left-2 text-white text-xs">
                    {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );

    return (
        <div>
            {/* Create Story Form Modal - 🔥 SỬA LẠI PHẦN NÀY */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-lg">
                        <StoryCreate
                            onStoryCreated={handleStoryCreated} // 🔥 TRUYỀN PROP NÀY
                            onClose={() => setShowCreateForm(false)} // 🔥 VÀ PROP NÀY
                        />
                    </div>
                </div>
            )}

            {/* Story Viewer Modal */}
            {viewingStory && selectedStory && !onViewStory && (
                <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                    <button
                        onClick={() => setViewingStory(false)}
                        className="absolute top-4 right-4 text-white text-xl"
                    >
                        ×
                    </button>
                    
                    <div className="w-full max-w-lg">
                        {selectedStory.mediaType === 'image' ? (
                            <img
                                src={selectedStory.mediaUrl}
                                alt="Story"
                                className="w-full h-auto"
                            />
                        ) : selectedStory.mediaType === 'video' ? (
                            <video
                                src={selectedStory.mediaUrl}
                                className="w-full h-auto"
                                controls
                                autoPlay
                            />
                        ) : (
                            <div
                                className="w-full h-96 flex items-center justify-center p-8"
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
                    <div className="w-full h-40 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
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
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                ) : (
                    stories.map(story => renderStoryItem(story))
                )}
            </div>
        </div>
    );
};

export default StoryList;