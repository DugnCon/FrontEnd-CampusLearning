"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  PhotoIcon,
  VideoCameraIcon,
  MapPinIcon,
  PaperClipIcon,
  XMarkIcon,
  GlobeAltIcon,
  UserGroupIcon,
  LockClosedIcon,
  SparklesIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline"
import postService from "@/services/postService"

const CreatePost = ({ onPostCreated }) => {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(false)
  const [visibility, setVisibility] = useState("public")
  const [showVisibilityOptions, setShowVisibilityOptions] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [contentError, setContentError] = useState("")
  const [mediaError, setMediaError] = useState("")
  const [location, setLocation] = useState(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [activeTab, setActiveTab] = useState("write")
  const fileInputRef = useRef(null)
  const [showDraftSaved, setShowDraftSaved] = useState(false)

  // IT topics for validation
  const itTopics = [
    "programming", "code", "software", "developer", "web", "app", "database", 
    "cloud", "server", "frontend", "backend", "fullstack", "javascript", 
    "python", "java", "react", "angular", "vue", "node", "php", "html", 
    "css", "api", "cybersecurity", "ai", "machine learning", "data science",
    "lập trình", "mã nguồn", "phần mềm", "phần cứng", "ứng dụng", "thiết kế web",
    "cơ sở dữ liệu", "điện toán đám mây", "máy chủ", "công nghệ thông tin",
    "hệ điều hành", "mạng máy tính", "bảo mật", "trí tuệ nhân tạo", "học máy"
  ]

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      if (user?.UserID) {
        setCurrentUser({
          name: user.FullName || user.username,
          avatar: user.ProfileImage || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
          username: user.username,
        })
      }
    }
  }, [])

  const saveDraft = () => {
    const draft = { title, content, location: location ? JSON.stringify(location) : null, savedAt: new Date().toISOString() }
    localStorage.setItem('postDraft', JSON.stringify(draft))
    setShowDraftSaved(true)
    setTimeout(() => setShowDraftSaved(false), 3000)
  }

  useEffect(() => {
    const savedDraft = localStorage.getItem('postDraft')
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setTitle(draft.title || '')
        setContent(draft.content || '')
        if (draft.location) setLocation(JSON.parse(draft.location))
      } catch (error) {
        console.error('Error loading draft:', error)
      }
    }
  }, [])

  const getCurrentLocation = () => {
    setLocationError("")
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ định vị.')
      return
    }

    setIsLoadingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'vi' } }
          )
          const data = await response.json()
          setLocation({
            latitude,
            longitude,
            displayName: data.display_name || 'Vị trí hiện tại',
            address: data.address
          })
        } catch (error) {
          setLocation({ latitude, longitude, displayName: 'Vị trí hiện tại' })
        } finally {
          setIsLoadingLocation(false)
        }
      },
      (error) => {
        setIsLoadingLocation(false)
        setLocationError(error.code === 1 ? 
          'Quyền định vị bị từ chối.' : 
          'Không thể lấy vị trí. Vui lòng thử lại sau.'
        )
      }
    )
  }

  const removeLocation = () => setLocation(null)

  const validateITContent = (text) => {
    if (!text.trim()) return false
    const lowerText = text.toLowerCase()
    return itTopics.some(topic => lowerText.includes(topic))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setContentError("")
    setMediaError("")
    
    if (media.length === 0) {
      setMediaError("Bài viết phải có ít nhất một ảnh hoặc video")
      return
    }
    
    if (content.trim() && !validateITContent(content)) {
      setContentError("Bài viết phải liên quan đến công nghệ thông tin (IT)")
      return
    }
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("content", content)
      formData.append("visibility", visibility)
      if (title) formData.append("title", title)
      media.forEach((file) => formData.append("media", file))
      if (location) formData.append("location", JSON.stringify(location))

      await postService.createPost(formData)

      setContent("")
      setTitle("")
      setMedia([])
      setLocation(null)
      localStorage.removeItem("postDraft")

      if (onPostCreated) onPostCreated()
    } catch (error) {
      console.error("Create post error:", error)
      alert("Có lỗi xảy ra khi đăng bài. Vui lòng thử lại sau.")
    } finally {
      setLoading(false)
    }
  }

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setMedia([...media, ...files])
      setMediaError("")
    }
  }

  const removeMedia = (index) => {
    const updatedMedia = media.filter((_, i) => i !== index)
    setMedia(updatedMedia)
    if (updatedMedia.length === 0) setMediaError("Bài viết phải có ít nhất một ảnh hoặc video")
  }

  const visibilityOptions = [
    { id: "public", label: "Công khai", description: "Mọi người đều có thể xem", icon: GlobeAltIcon, color: "text-green-600" },
    { id: "friends", label: "Bạn bè", description: "Chỉ bạn bè có thể xem", icon: UserGroupIcon, color: "text-blue-600" },
    { id: "private", label: "Riêng tư", description: "Chỉ bạn có thể xem", icon: LockClosedIcon, color: "text-gray-600" },
  ]

  return (
    <div className="flex flex-col w-full max-w-full">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 p-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-xl">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold text-2xl">Tạo bài viết mới</h2>
                <p className="text-blue-100">Chia sẻ kiến thức IT của bạn với cộng đồng</p>
              </div>
            </div>
            <button 
              onClick={saveDraft}
              className="px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-xl hover:bg-opacity-30 transition-all duration-300 border border-white border-opacity-30"
            >
              Lưu bản nháp
            </button>
          </div>
        </div>

        {/* User info with glass effect */}
        {currentUser && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="relative">
                  <img 
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-12 h-12 rounded-2xl border-2 border-white shadow-lg"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="ml-4">
                  <div className="font-semibold text-gray-900">{currentUser.name}</div>
                  <button
                    type="button"
                    onClick={() => setShowVisibilityOptions(!showVisibilityOptions)}
                    className="flex items-center space-x-1 py-1 px-3 bg-white rounded-full hover:bg-gray-50 transition-all duration-300 border border-gray-200 shadow-sm"
                  >
                    {(() => {
                      const option = visibilityOptions.find((opt) => opt.id === visibility)
                      const Icon = option?.icon
                      return (
                        <>
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          <span className="text-sm font-medium text-gray-700">{option?.label}</span>
                          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </>
                      )
                    })()}
                  </button>
                </div>
              </div>

              {showVisibilityOptions && (
                <div className="absolute mt-2 top-20 right-6 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 z-20 w-72">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">Chế độ hiển thị</div>
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`w-full text-left p-3 rounded-xl transition-all duration-300 ${
                          visibility === option.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          setVisibility(option.id)
                          setShowVisibilityOptions(false)
                        }}
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${visibility === option.id ? "bg-white shadow-sm" : "bg-gray-50"}`}>
                            <Icon className={`w-5 h-5 ${option.color}`} />
                          </div>
                          <div className="ml-3">
                            <div className={`font-medium text-sm ${visibility === option.id ? "text-blue-700" : "text-gray-700"}`}>
                              {option.label}
                            </div>
                            <div className="text-xs text-gray-500">{option.description}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row w-full">
          {/* Left side - Form */}
          <div className="lg:w-3/5 p-6 lg:border-r lg:border-gray-100">
            <form onSubmit={handleSubmit}>
              {/* Title with elegant styling */}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    id="title"
                    placeholder="Tiêu đề bài viết..."
                    className="w-full p-4 text-xl font-semibold border-0 focus:ring-0 focus:outline-none bg-gray-50 rounded-2xl placeholder-gray-400"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent focus-within:border-blue-500 pointer-events-none"></div>
                </div>
              </div>
              
              {/* Content with tabbed interface */}
              <div className="mb-6">
                <div className="flex border-b border-gray-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    className={`flex items-center px-4 py-3 font-medium text-sm rounded-t-lg transition-all duration-300 ${
                      activeTab === "write" 
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                    Viết
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center px-4 py-3 font-medium text-sm rounded-t-lg transition-all duration-300 ${
                      activeTab === "preview" 
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" 
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <EyeIcon className="w-4 h-4 mr-2" />
                    Xem trước
                  </button>
                </div>

                <div className="relative">
                  {activeTab === "write" ? (
                    <textarea
                      id="content"
                      className="w-full p-6 border-0 focus:ring-0 focus:outline-none min-h-[400px] text-gray-700 placeholder-gray-400 resize-none bg-gray-50 rounded-2xl font-mono text-sm"
                      placeholder="Chia sẻ ý tưởng, câu hỏi, hoặc kiến thức về IT của bạn...

Bạn có thể sử dụng Markdown để định dạng văn bản:
- Danh sách
- **In đậm** hoặc *in nghiêng*
- Code blocks ```
- Và nhiều tính năng khác"
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value)
                        if (contentError) setContentError("")
                      }}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-6 min-h-[400px] prose prose-sm max-w-none">
                      {content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-gray-400 italic">Chưa có nội dung để xem trước</p>
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent pointer-events-none"></div>
                </div>
                
                {contentError && (
                  <div className="mt-3 flex items-center text-red-500 text-sm bg-red-50 px-4 py-2 rounded-xl">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {contentError}
                  </div>
                )}
              </div>

              {/* Media section with enhanced design */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <div className="text-sm font-semibold flex items-center">
                      <PhotoIcon className="w-5 h-5 mr-2 text-gray-600" />
                      <span>Hình ảnh/Video</span>
                      <span className="text-red-500 ml-1">*</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">(Bắt buộc)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all duration-300 font-medium shadow-sm"
                  >
                    Thêm file
                  </button>
                </div>
                
                {media.length === 0 ? (
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      mediaError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                    }`}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <div className={`rounded-2xl p-4 mb-4 ${mediaError ? 'bg-red-100' : 'bg-white shadow-sm'}`}>
                      <PhotoIcon className={`h-12 w-12 ${mediaError ? 'text-red-500' : 'text-gray-500'}`} />
                    </div>
                    <div className="font-semibold text-lg mb-2">Thêm ảnh hoặc video</div>
                    <div className="text-sm text-gray-500 text-center max-w-sm">
                      Kéo thả file vào đây hoặc nhấn để chọn từ thiết bị
                    </div>
                    {mediaError && (
                      <div className="text-red-500 text-sm mt-4 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {mediaError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-sm font-semibold">Media đính kèm ({media.length})</div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Thêm file khác
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {media.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="h-32 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
                            {file.type.startsWith("image/") ? (
                              <img
                                src={URL.createObjectURL(file)}
                                alt="Preview"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : file.type.startsWith("video/") ? (
                              <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-100 to-blue-100">
                                <VideoCameraIcon className="h-8 w-8 text-purple-600" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200">
                                <PaperClipIcon className="h-8 w-8 text-gray-600" />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia(index)}
                            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:bg-red-600"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <div className="text-xs text-white truncate">{file.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaChange}
                />
              </div>

              {/* Location with enhanced design */}
              {location && (
                <div className="mb-4 flex items-center bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 px-4 py-3 rounded-xl text-sm border border-blue-200">
                  <MapPinIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">{location.displayName}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={removeLocation}
                    className="ml-2 text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              )}

              {locationError && (
                <div className="mb-4 text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-200">
                  {locationError}
                </div>
              )}

              {/* Enhanced Action buttons */}
              <div className="flex flex-wrap items-center border-t border-gray-200 pt-6">
                <div className="flex items-center space-x-3 mr-auto">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="flex items-center p-3 rounded-xl hover:bg-gray-100 text-gray-700 transition-all duration-300 group"
                    title="Thêm ảnh/video"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <PhotoIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="flex items-center p-3 rounded-xl hover:bg-gray-100 text-gray-700 transition-all duration-300 group"
                    title="Thêm vị trí"
                    disabled={isLoadingLocation || location !== null}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${
                      isLoadingLocation || location !== null ? 'bg-gray-100' : 'bg-green-100 group-hover:bg-green-200'
                    }`}>
                      {isLoadingLocation ? (
                        <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <MapPinIcon className={`h-5 w-5 ${location !== null ? 'text-gray-400' : 'text-green-600'}`} />
                      )}
                    </div>
                  </button>
                  
                  <div className="flex items-center bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl px-4 py-2 border border-purple-200">
                    <SparklesIcon className="h-4 w-4 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-700">Hỗ trợ Markdown</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || media.length === 0}
                  className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg ${
                    loading || media.length === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Đang đăng...</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 mr-2" />
                      <span>Đăng bài</span>
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right side - Enhanced Preview */}
          <div className="lg:w-2/5 bg-gradient-to-b from-gray-50 to-white p-6">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-gray-900">Xem trước bài viết</h3>
                <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border">Real-time</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                {/* Preview header */}
                <div className="p-6 border-b border-gray-100">
                  {currentUser && (
                    <div className="flex items-center mb-4">
                      <img 
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-xl border-2 border-white shadow-sm"
                      />
                      <div className="ml-3">
                        <div className="font-semibold text-gray-900">{currentUser.name}</div>
                        <div className="text-xs text-gray-500">Vừa xong • {visibilityOptions.find(opt => opt.id === visibility)?.label}</div>
                      </div>
                    </div>
                  )}
                  
                  {title && (
                    <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{title}</h2>
                  )}
                </div>

                {/* Preview content */}
                <div className="p-6">
                  <div className="prose prose-sm max-w-none mb-6">
                    {content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-gray-400 italic">Nội dung bài viết sẽ xuất hiện ở đây...</p>
                    )}
                  </div>

                  {media.length > 0 && (
                    <div className={`mb-6 ${media.length === 1 ? 'single-media' : 'grid gap-3'}`}>
                      {media.length === 1 ? (
                        <div className="rounded-xl overflow-hidden bg-gray-100">
                          {media[0].type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(media[0])}
                              alt="Preview"
                              className="w-full max-h-96 object-contain"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-40 bg-gradient-to-br from-purple-100 to-blue-100">
                              <VideoCameraIcon className="h-12 w-12 text-purple-600" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`grid gap-3 ${media.length === 2 ? 'grid-cols-2' : media.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                          {media.slice(0, 4).map((file, index) => (
                            <div key={index} className={`relative rounded-xl overflow-hidden bg-gray-100 ${
                              index === 3 && media.length > 4 ? "relative" : ""
                            }`}>
                              {file.type.startsWith("image/") ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-32 object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-32 bg-gradient-to-br from-purple-100 to-blue-100">
                                  <VideoCameraIcon className="h-8 w-8 text-purple-600" />
                                </div>
                              )}
                              {index === 3 && media.length > 4 && (
                                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                                  <div className="text-white font-bold text-xl">+{media.length - 4}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {location && (
                    <div className="flex items-center text-sm text-blue-600 mb-6 bg-blue-50 px-4 py-2 rounded-xl">
                      <MapPinIcon className="h-4 w-4 mr-2" />
                      <span className="font-medium">{location.displayName}</span>
                    </div>
                  )}

                  {/* Preview actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors">
                        <div className="p-1 rounded-lg hover:bg-gray-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium">Thích</span>
                      </button>
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors">
                        <div className="p-1 rounded-lg hover:bg-gray-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium">Bình luận</span>
                      </button>
                    </div>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors">
                      <div className="p-1 rounded-lg hover:bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview tips */}
              <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
                <div className="flex items-start">
                  <SparklesIcon className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-blue-900 text-sm mb-1">Mẹo hay</div>
                    <div className="text-blue-700 text-sm">
                      Sử dụng Markdown để bài viết thêm chuyên nghiệp. Định dạng code, lists, và headings sẽ giúp nội dung rõ ràng hơn.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Draft saved notification */}
      {showDraftSaved && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 animate-in slide-in-from-bottom duration-300">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Đã lưu bản nháp thành công!</span>
        </div>
      )}
    </div>
  )
}

export default CreatePost