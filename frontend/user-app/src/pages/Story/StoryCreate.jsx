import React, { useState, useRef } from 'react';
import { 
  XMarkIcon, 
  PhotoIcon, 
  VideoCameraIcon, 
  FaceSmileIcon,
  SwatchIcon
} from '@heroicons/react/24/outline';

const StoryCreate = ({ onStoryCreated, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [storyType, setStoryType] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#6366f1');
  const [fontStyle, setFontStyle] = useState('font-sans');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const backgroundColors = [
    '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#000000'
  ];

  const fontStyles = [
    { value: 'font-sans', label: 'Modern', className: 'font-sans' },
    { value: 'font-serif', label: 'Elegant', className: 'font-serif' },
    { value: 'font-mono', label: 'Minimal', className: 'font-mono' },
    { value: 'font-bold', label: 'Bold', className: 'font-bold' }
  ];

  // 🔥 HÀM UPLOAD VIDEO CHUNK
  const handleVideoChunkUpload = async (file, token) => {
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';

    console.log(`🎬 Starting video chunk upload: ${file.name}`);
    console.log(`📊 File size: ${file.size} bytes, Total chunks: ${totalChunks}`);

    // Upload từng chunk
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('video', chunk);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('fileName', file.name);

      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/stories/video-chunk`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(`Lỗi upload chunk ${chunkIndex + 1}: ${errorData.message || 'Unknown error'}`);
        }

        const result = await uploadResponse.json();
        
        if (!result.success) {
          throw new Error(`Chunk ${chunkIndex + 1} failed: ${result.message}`);
        }

        // Cập nhật tiến trình
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setUploadProgress(progress);
        
        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${progress}%)`);

      } catch (err) {
        console.error(`❌ Chunk ${chunkIndex + 1} upload failed:`, err);
        throw new Error(`Upload chunk ${chunkIndex + 1} thất bại: ${err.message}`);
      }
    }

    console.log('🎉 Video upload completed!');
    
    // Trả về kết quả giả định (BE sẽ trả về URL thực tế)
    return {
      success: true,
      message: 'Video uploaded successfully',
      videoUrl: `/uploads/${Date.now()}-${file.name}`,
      mediaType: 'video'
    };
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setStoryType('image');
    } else if (file.type.startsWith('video/')) {
      setStoryType('video');
    } else {
      setError('Chỉ hỗ trợ file ảnh và video');
      return;
    }

    // Kiểm tra kích thước file
    const maxSize = storyType === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File không được vượt quá ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadProgress(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Vui lòng đăng nhập');
      }

      let responseData;

      if (storyType === 'text') {
        // 🔥 API CŨ CHO TEXT
        if (!textContent.trim()) {
          throw new Error('Vui lòng nhập nội dung');
        }

        const formData = new FormData();
        formData.append('textContent', textContent);
        formData.append('backgroundColor', backgroundColor);
        formData.append('fontStyle', fontStyle);
        formData.append('mediaType', 'text');

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        const response = await fetch(`${API_BASE_URL}/stories`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Không thể tạo story');
        }

        responseData = await response.json();

      } else if (storyType === 'image') {
        // 🔥 API CŨ CHO ẢNH
        const formData = new FormData();
        formData.append('mediaFile', selectedFile);
        formData.append('mediaType', 'image');

        const API_BASE_URL = import.meta.env.VITE_API_URL || '/user/api';
        const response = await fetch(`${API_BASE_URL}/stories`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Không thể tạo story');
        }

        responseData = await response.json();

      } else if (storyType === 'video') {
        // 🔥 API MỚI CHO VIDEO CHUNK
        responseData = await handleVideoChunkUpload(selectedFile, token);
      }

      // 🔥 QUAN TRỌNG: Gọi callback trước khi reload
      if (onStoryCreated) {
        onStoryCreated(responseData);
      }

      // 🔥 TỰ ĐỘNG RELOAD TRANG
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err) {
      console.error('Create story error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setStoryType('text');
    setUploadProgress(0);
  };

  const renderPreview = () => {
    if (storyType === 'text') {
      return (
        <div 
          className="w-full aspect-[9/16] max-h-[70vh] rounded-2xl flex items-center justify-center p-8 transition-all duration-300 shadow-lg"
          style={{ backgroundColor }}
        >
          <p className={`text-white text-2xl text-center leading-relaxed ${fontStyle} transition-all duration-300`}>
            {textContent || 'Bắt đầu chia sẻ câu chuyện của bạn...'}
          </p>
        </div>
      );
    } else if (storyType === 'image' && selectedFile) {
      const previewUrl = URL.createObjectURL(selectedFile);
      return (
        <div className="w-full aspect-[9/16] max-h-[70vh] rounded-2xl overflow-hidden shadow-lg">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
            onLoad={() => URL.revokeObjectURL(previewUrl)}
          />
        </div>
      );
    } else if (storyType === 'video' && selectedFile) {
      const previewUrl = URL.createObjectURL(selectedFile);
      return (
        <div className="w-full aspect-[9/16] max-h-[70vh] rounded-2xl overflow-hidden shadow-lg relative">
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            controls
            onLoadStart={() => URL.revokeObjectURL(previewUrl)}
          />
          {/* Progress bar for video upload */}
          {loading && storyType === 'video' && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/50 rounded-full overflow-hidden">
              <div 
                className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="w-full aspect-[9/16] max-h-[70vh] rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <PhotoIcon className="w-8 h-8 text-white" />
          </div>
          <p className="text-lg font-medium text-gray-600 mb-2">Thêm ảnh hoặc video</p>
          <p className="text-sm text-gray-500">Kéo thả hoặc chọn từ thiết bị</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Tạo Story
            </h2>
            <p className="text-sm text-gray-500 mt-1">Chia sẻ khoảnh khắc của bạn</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500 group-hover:text-gray-700" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Preview Section */}
            <div className="mb-6">
              {renderPreview()}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Upload Progress for Video */}
            {loading && storyType === 'video' && uploadProgress > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">Đang upload video...</span>
                  <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Đang xử lý video chunk... ({Math.round(selectedFile?.size / (1024 * 1024))}MB)
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-6">
              {/* Story Type Selection */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <SwatchIcon className="w-4 h-4 mr-2" />
                  Loại nội dung
                </h3>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStoryType('text')}
                    className={`flex-1 py-4 px-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                      storyType === 'text' 
                        ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10' 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      storyType === 'text' ? 'bg-blue-500' : 'bg-gray-200'
                    }`}>
                      <FaceSmileIcon className={`w-5 h-5 ${
                        storyType === 'text' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      storyType === 'text' ? 'text-blue-600' : 'text-gray-600'
                    }`}>Văn bản</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className={`flex-1 py-4 px-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                      (storyType === 'image' || storyType === 'video')
                        ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10' 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      (storyType === 'image' || storyType === 'video') ? 'bg-blue-500' : 'bg-gray-200'
                    }`}>
                      <PhotoIcon className={`w-5 h-5 ${
                        (storyType === 'image' || storyType === 'video') ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      (storyType === 'image' || storyType === 'video') ? 'text-blue-600' : 'text-gray-600'
                    }`}>Đa phương tiện</span>
                  </button>
                </div>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />

              {/* Text Story Controls */}
              {storyType === 'text' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                      </svg>
                      Nội dung
                    </h3>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Chia sẻ điều gì đó đặc biệt..."
                      className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-lg placeholder-gray-400"
                      maxLength={120}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">{textContent.length}/120 ký tự</span>
                    </div>
                  </div>

                  {/* Background Colors */}
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Màu nền</h3>
                    <div className="grid grid-cols-8 gap-2">
                      {backgroundColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBackgroundColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform duration-200 ${
                            backgroundColor === color 
                              ? 'border-white ring-2 ring-blue-500 ring-offset-2 scale-110' 
                              : 'border-gray-200 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font Styles */}
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Kiểu chữ</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {fontStyles.map(style => (
                        <button
                          key={style.value}
                          type="button"
                          onClick={() => setFontStyle(style.value)}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                            fontStyle === style.value
                              ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`text-lg mb-1 ${style.className}`}>
                            Aa
                          </div>
                          <div className={`text-sm font-medium ${
                            fontStyle === style.value ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {style.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              {(storyType === 'image' || storyType === 'video') && selectedFile && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        {storyType === 'image' ? (
                          <PhotoIcon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <VideoCameraIcon className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • 
                          {storyType === 'video' ? ' Video (chunk upload)' : ' Ảnh'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                    >
                      <XMarkIcon className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="border-t border-gray-100 bg-white p-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (storyType === 'text' && !textContent.trim()) || ((storyType === 'image' || storyType === 'video') && !selectedFile)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  {storyType === 'video' ? `Uploading... ${uploadProgress}%` : 'Đang đăng...'}
                </>
              ) : (
                <>
                  <PhotoIcon className="w-4 h-4" />
                  Đăng Story
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryCreate;