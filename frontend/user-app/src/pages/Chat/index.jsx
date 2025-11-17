// components/Chat/Chat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  PaperAirplaneIcon, 
  PhoneIcon,
  VideoCameraIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PaperClipIcon,
  FaceSmileIcon,
  XMarkIcon,
  ChevronLeftIcon,
  TrashIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { chatApi } from '../../api/chatApi';
import { callApi } from '../../api/callApi';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCall } from '../../contexts/CallContext'; 
import Avatar from '../../components/common/Avatar';
import CallInterface from '../../components/Call/CallInterface';
import { API_URL } from '../../config';

const Chat = () => {
  // === STATE ===
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchUsers, setSearchUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showConversations, setShowConversations] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // === STATE MỚI CHO EDIT MESSAGE ===
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [updatingMessage, setUpdatingMessage] = useState(false);

  // === STATE MỚI CHO NÚT NHẮN TIN ===
  const [creatingConversations, setCreatingConversations] = useState({});

  // === REFS ===
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const deleteMenuRef = useRef(null);
  const editInputRef = useRef(null);

  // === HOOKS ===
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, subscribe, unsubscribe, sendMessage } = useSocket();
  const { user } = useAuth();

  // === CALL CONTEXT - THAY THẾ STATE CALL CŨ ===
  const {
    // State
    call,
    callStatus, 
    callType,
    isReceivingCall,
    isMakingCall,
    callDuration,
    
    // Methods
    initiateCall,
    answerCall,
    endCall,
    rejectCall,
    toggleAudio,
    toggleVideo
  } = useCall();

  // === AUTO SCROLL ===
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Thêm debug chi tiết
  useEffect(() => {
    console.log('🔄 MESSAGES STATE ANALYSIS:');
    
    // Phân tích state
    const tempMessages = messages.filter(m => m.isTemp);
    const realMessages = messages.filter(m => !m.isTemp);
    const duplicateIds = findDuplicates(messages.map(m => m.messageID));
    
    console.log(`   Total: ${messages.length}`);
    console.log(`   Temp: ${tempMessages.length}`, tempMessages.map(m => m.messageID));
    console.log(`   Real: ${realMessages.length}`, realMessages.map(m => m.messageID));
    
    if (duplicateIds.length > 0) {
        console.warn('🚨 DUPLICATE IDs:', duplicateIds);
    }
    
    if (tempMessages.length > 0 && realMessages.length > 0) {
        // Kiểm tra xem có temp và real cùng content không (có thể là cùng 1 message)
        tempMessages.forEach(temp => {
            const matchingReal = realMessages.find(real => 
                real.content === temp.content && 
                real.senderID === temp.senderID
            );
            if (matchingReal) {
                console.warn('🚨 POSSIBLE DUPLICATE:', {
                    temp: temp.messageID,
                    real: matchingReal.messageID,
                    content: temp.content
                });
            }
        });
    }
  }, [messages]);

  // Hàm tìm duplicate
  const findDuplicates = (arr) => {
    return arr.filter((item, index) => arr.indexOf(item) !== index);
  };

  // === LOAD ON MOUNT ===
  useEffect(() => {
    loadConversations();
    const selectedUser = location.state?.selectedUser;
    if (selectedUser) handleStartConversation(selectedUser);
  }, [location.state]);

  // === STOMP LISTENERS ===
  useEffect(() => {
    if (!isConnected || !currentConversation) return;

    const messageDestination = `/topic/conversation.${currentConversation.conversationID}`;
    const messageSub = subscribe(messageDestination, (data) => {
      console.log('📨 Received message:', data);
      
      switch (data.type) {
        case 'NEW_MESSAGE':
        case 'MESSAGE_SENT':
          handleRealTimeMessage(data);
          break;
        case 'MESSAGE_DELETED':
          handleMessageDeleted(data.data);
          break;
        case 'MESSAGE_UPDATED':
          handleMessageUpdated(data.data);
          break;
        case 'MESSAGE_FAILED':
          handleMessageFailed(data.data);
          break;
        case 'TYPING':
          handleUserTyping(data.data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    });

    const typingDestination = `/topic/conversation.${currentConversation.conversationID}.typing`;
    const typingSub = subscribe(typingDestination, (data) => {
      if (data.type === 'TYPING') {
        handleUserTyping(data.data);
      }
    });

    sendMessage('/chat.join', {
      conversationId: currentConversation.conversationID
    });

    return () => {
      if (messageSub) unsubscribe(messageDestination);
      if (typingSub) unsubscribe(typingDestination);
    };
  }, [isConnected, currentConversation, subscribe, unsubscribe, sendMessage]);

  // === HANDLE REAL-TIME MESSAGES ===
  const handleRealTimeMessage = useCallback((data) => {
    console.log('📨 Received real message:', data);

    if (data.type !== 'NEW_MESSAGE') return;

    const messageData = data.data;
    const messageId = messageData.messageID;

    if (!messageId) return;

    setMessages(prev => {
        const alreadyExists = prev.some(msg => msg.messageID === messageId);
        if (alreadyExists) {
            console.log('⏩ Message already exists, skipping:', messageId);
            return prev;
        }
        
        console.log('➕ Adding new real message:', messageId);
        return [...prev, { 
            ...messageData, 
            status: 'sent'
        }];
    });

    // Update last message
    if (data.conversationId === currentConversation?.conversationID) {
        setConversations(prev =>
            prev.map(conv =>
                conv.conversationID === data.conversationId
                    ? {
                          ...conv,
                          lastMessageContent: messageData.content,
                          lastMessageTime: messageData.createdAt,
                          lastMessageSender: messageData.senderName || messageData.senderUsername
                      }
                    : conv
            )
        );
    }
  }, [currentConversation]);

  // === HANDLE MESSAGE UPDATED ===
  const handleMessageUpdated = useCallback((data) => {
    const { messageId, content, isEdited, editedAt } = data;
    
    setMessages(prev => 
      prev.map(msg =>
        msg.messageID === messageId
          ? { 
              ...msg, 
              content,
              isEdited: isEdited || true,
              editedAt: editedAt || new Date().toISOString()
            }
          : msg
      )
    );
  }, []);

  // === HANDLE MESSAGE FAILED ===
  const handleMessageFailed = useCallback((errorData) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.messageID === errorData.tempMessageId 
          ? { ...msg, status: 'failed', error: errorData.error }
          : msg
      )
    );
    toast.error(`Gửi tin nhắn thất bại: ${errorData.error}`);
  }, []);

  // === HANDLE MESSAGE DELETED ===
  const handleMessageDeleted = useCallback((data) => {
    const { messageId, conversationId, deleteForEveryone } = data;
    
    setMessages(prev => {
      if (currentConversation?.conversationID !== conversationId) return prev;
      return prev.map(msg =>
        msg.messageID === messageId
          ? { ...msg, isDeleted: true, deleteForEveryone }
          : msg
      );
    });
    
    setConversations(prev =>
      prev.map(conv =>
        conv.conversationID === conversationId
          ? { ...conv, lastMessageContent: 'Tin nhắn đã bị xóa' }
          : conv
      )
    );
  }, [currentConversation]);

  // === HANDLE USER TYPING ===
  const handleUserTyping = useCallback((data) => {
    const { conversationId, userId, username, isTyping } = data;
    
    if (currentConversation?.conversationID === conversationId) {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: isTyping 
          ? { ...prev[conversationId], [userId]: username }
          : { ...prev[conversationId], [userId]: undefined }
      }));
    }
  }, [currentConversation]);

  // === LOAD CONVERSATIONS ===
  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await chatApi.getConversations();
      if (response.success) setConversations(response.data || []);
    } catch (error) {
      toast.error('Không thể tải cuộc trò chuyện');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await chatApi.getMessages(conversationId);
      setMessages(response.success ? (response.data || []) : []);
    } catch (error) {
      console.error('Load messages error:', error);
      setMessages([]);
      toast.error('Không thể tải tin nhắn');
    }
  };

  const selectConversation = (conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    loadMessages(conversation.conversationID);
    
    if (isConnected) {
      sendMessage('/chat.join', {
        conversationId: conversation.conversationID
      });
    }
    
    if (isMobileView) setShowConversations(false);
    setShowDeleteMenu(false);
    cancelEditMessage();
  };

  // === SEND MESSAGE ===
  const sendMessageHandler = async () => {
    if (!newMessage.trim() || !currentConversation || sendingMessage) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSendingMessage(true);

    try {
        const response = await chatApi.sendMessage({
            conversationId: currentConversation.conversationID,
            content: text,
            type: 'text'
        });

        if (!response.success) {
            toast.error('Gửi tin nhắn thất bại');
        }
    } catch (error) {
        toast.error('Lỗi kết nối');
    } finally {
        setSendingMessage(false);
    }
  };

  // === DELETE MESSAGE ===
  const deleteMessage = async (messageId, deleteForEveryone = false) => {
    if (deletingMessage || !messageId) return;
    
    setDeletingMessage(true);
    
    try {
        console.log('🗑️ Deleting message:', { messageId, deleteForEveryone });
        
        setMessages(prev => 
            prev.map(msg =>
                msg.messageID === messageId
                    ? { ...msg, isDeleted: true, deleteForEveryone }
                    : msg
            )
        );
        
        const response = await chatApi.deleteMessage(messageId);
        
        if (response.success) {
            console.log('✅ Message deleted successfully');
            
            if (isConnected && deleteForEveryone) {
                sendMessage('/chat.deleteMessage', {
                    messageId: messageId,
                    conversationId: currentConversation.conversationID,
                    deleteForEveryone
                });
            }
            
            toast.success(deleteForEveryone ? 'Đã xóa cho mọi người' : 'Đã xóa cho bạn');
        } else {
            setMessages(prev => 
                prev.map(msg =>
                    msg.messageID === messageId
                        ? { ...msg, isDeleted: false, deleteForEveryone: false }
                        : msg
                )
            );
            toast.error('Không thể xóa tin nhắn: ' + (response.message || response.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Delete message error:', error);
        
        setMessages(prev => 
            prev.map(msg =>
                msg.messageID === messageId
                    ? { ...msg, isDeleted: false, deleteForEveryone: false }
                    : msg
            )
        );
        
        toast.error('Lỗi kết nối khi xóa tin nhắn');
    } finally {
        setDeletingMessage(false);
        setShowDeleteMenu(false);
        setLongPressedMessage(null);
    }
  };

  // === EDIT MESSAGE ===
  const startEditMessage = (message) => {
    if (message.Type === 'file' || message.type === 'file') {
      toast.error('Không thể chỉnh sửa tin nhắn file');
      return;
    }
    
    setEditingMessage(message);
    setEditText(message.Content || message.content || '');
    setShowDeleteMenu(false);
    
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 100);
  };

  const cancelEditMessage = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const updateMessage = async () => {
    if (!editingMessage || !editText.trim() || updatingMessage) return;

    const originalContent = editingMessage.Content || editingMessage.content;
    if (editText.trim() === originalContent) {
      cancelEditMessage();
      return;
    }

    try {
      setUpdatingMessage(true);
      
      setMessages(prev => 
        prev.map(msg =>
          msg.messageID === editingMessage.messageID
            ? { 
                ...msg, 
                content: editText.trim(),
                isEdited: true,
                editedAt: new Date().toISOString()
              }
            : msg
        )
      );

      const response = await chatApi.updateMessage(editingMessage.messageID, {
        content: editText.trim()
      });

      if (response.success) {
        toast.success('Đã cập nhật tin nhắn');
        
        if (isConnected) {
          sendMessage('/chat.updateMessage', {
            messageId: editingMessage.messageID,
            conversationId: currentConversation.conversationID,
            content: editText.trim(),
            isEdited: true,
            editedAt: new Date().toISOString()
          });
        }
      } else {
        setMessages(prev => 
          prev.map(msg =>
            msg.messageID === editingMessage.messageID
              ? { 
                  ...msg, 
                  content: originalContent,
                  isEdited: false,
                  editedAt: null
                }
              : msg
          )
        );
        toast.error('Không thể cập nhật tin nhắn');
      }
    } catch (error) {
      console.error('Edit message error:', error);
      
      setMessages(prev => 
        prev.map(msg =>
          msg.messageID === editingMessage.messageID
            ? { 
                ...msg, 
                content: originalContent,
                isEdited: false,
                editedAt: null
              }
            : msg
        )
      );
      
      toast.error('Lỗi kết nối khi cập nhật tin nhắn');
    } finally {
      cancelEditMessage();
      setUpdatingMessage(false);
    }
  };

  // === LONG PRESS HANDLER ===
  const handleLongPress = (message, e) => {
    e.preventDefault();
    setLongPressedMessage(message);
    setShowDeleteMenu(true);
  };

  // === CLICK OUTSIDE TO CLOSE MENU ===
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target)) {
        setShowDeleteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === TYPING ===
  const handleTyping = () => {
    if (!currentConversation || !isConnected) return;

    sendMessage('/chat.typing', {
      conversationId: currentConversation.conversationID,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendMessage('/chat.typing', {
        conversationId: currentConversation.conversationID,
        isTyping: false
      });
    }, 1000);
  };

  // === SEARCH USERS ===
  const searchUsersHandler = async (query) => {
    if (!query.trim() || query.length < 2) { setSearchUsers([]); return; }
    try {
      setSearchingUsers(true);
      const response = await chatApi.searchUsers(query);
      if (response.success) setSearchUsers(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setSearchingUsers(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchUsersHandler(userSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [userSearchTerm]);

  // === START CONVERSATION ===
  const handleStartConversation = async (selectedUser) => {
    if (creatingConversations[selectedUser.userID]) {
      console.log('🛑 Đang tạo conversation, vui lòng đợi...');
      return;
    }

    try {
      setCreatingConversations(prev => ({
        ...prev,
        [selectedUser.userID]: true
      }));

      const response = await chatApi.createConversation({
        participants: [selectedUser.userID],
        type: 'private'
      });
      
      if (response.success) {
        const existing = conversations.find(c => c.conversationID === response.data.conversationID);
        if (!existing) setConversations(prev => [response.data, ...prev]);
        selectConversation(response.data);
        setShowUserSearch(false); 
        setUserSearchTerm('');
        toast.success('Đã bắt đầu cuộc trò chuyện');
      }
    } catch (error) {
      console.error('Create conversation error:', error);
      toast.error('Không thể tạo cuộc trò chuyện');
    } finally {
      setCreatingConversations(prev => ({
        ...prev,
        [selectedUser.userID]: false
      }));
    }
  };

  // === CREATE GROUP ===
  const createGroupConversation = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast.error('Nhập tên nhóm và chọn thành viên');
      return;
    }
    try {
      setCreatingGroup(true);
      const response = await chatApi.createConversation({
        title: groupName,
        participants: selectedUsers.map(u => u.userID),
        type: 'group'
      });
      if (response.success) {
        setConversations(prev => [response.data, ...prev]);
        selectConversation(response.data);
        setShowCreateGroup(false); 
        setGroupName(''); 
        setSelectedUsers([]);
        toast.success('Tạo nhóm thành công');
      }
    } catch (error) {
      toast.error('Không thể tạo nhóm');
    } finally {
      setCreatingGroup(false);
    }
  };

  // === FILE UPLOAD HANDLERS ===
  const sendFileMessage = async (files) => {
    if (!currentConversation || !files.length || sendingMessage) return;

    try {
        setSendingMessage(true);
        
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`File ${file.name} vượt quá 10MB`);
                continue;
            }

            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'video/mp4', 'video/avi', 'video/mov', 'video/webm',
                'application/pdf', 'text/plain',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                toast.error(`Loại file ${file.type} không được hỗ trợ`);
                continue;
            }

            const response = await chatApi.sendFileMessage(
                currentConversation.conversationID,
                file,
                '',
                (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    console.log(`Upload progress: ${percentCompleted}%`);
                }
            );
            
            if (response.success) {
                toast.success(`Đã gửi file: ${file.name}`);
            } else {
                toast.error(`Lỗi gửi file: ${file.name}`);
            }
        }
    } catch (error) {
        console.error('Upload file error:', error);
        toast.error('Lỗi khi gửi file');
    } finally {
        setSendingMessage(false);
        setSelectedFiles([]);
        setShowFilePreview(false);
        setUploadProgress({});
    }
  };

  // Xử lý khi chọn file từ input
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setShowFilePreview(true);
    }
    e.target.value = '';
  };

  // Xử lý drag & drop
  const handleFileDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-2', 'border-dashed', 'border-blue-300');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setShowFilePreview(true);
    }
  };

  // Drag over effect
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50', 'border-2', 'border-dashed', 'border-blue-300');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-2', 'border-dashed', 'border-blue-300');
  };

  // Mở file picker
  const openFilePicker = () => fileInputRef.current?.click();

  // Hủy gửi file
  const cancelFileSend = () => {
    setSelectedFiles([]);
    setShowFilePreview(false);
  };

  // === CALL FUNCTIONS - SỬ DỤNG CALLCONTEXT ===
  const startAudioCall = async () => {
    if (!currentConversation) return;
    try {
      await initiateCall(currentConversation.conversationID, 'audio');
      toast.info('Đang gọi...');
    } catch (error) {
      toast.error('Không thể gọi: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const startVideoCall = async () => {
    if (!currentConversation) return;
    try {
      await initiateCall(currentConversation.conversationID, 'video');
      toast.info('Đang gọi video...');
    } catch (error) {
      toast.error('Không thể gọi video: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  // === FORMAT DATA CHO CALL INTERFACE ===
  const getCallData = () => {
    if (!call) return null;
    
    // Format data để tương thích với CallInterface
    return {
      ...call,
      participants: currentConversation?.participants || [],
      initiatorId: call.initiatorId || call.initiatorID,
      receiverId: call.receiverId || call.receiverID,
      // Giữ nguyên structure cũ
      callID: call.callId || call.callID,
      Type: callType || call.type
    };
  };

  const renderFileMessage = (message) => {
    if (message.Type !== 'file' && message.type !== 'file') return null;
    
    let fileInfo;
    try {
        fileInfo = message.metadata ? JSON.parse(message.metadata) : message.fileInfo;
    } catch {
        fileInfo = message.fileInfo || {};
    }
    
    const isImage = fileInfo.type === 'image' || fileInfo.mimetype?.startsWith('image/');
    const isVideo = fileInfo.type === 'video' || fileInfo.mimetype?.startsWith('video/');
    const fileUrl = message.mediaUrl || message.fileUrl;
    
    return (
        <div className="max-w-xs">
            {isImage ? (
                <div className="cursor-pointer" onClick={() => window.open(`${API_URL}${fileUrl}`, '_blank')}>
                    <img 
                        src={`${API_URL}${fileUrl}`}
                        alt={fileInfo.originalName}
                        className="rounded-lg max-h-60 w-full object-cover"
                    />
                </div>
            ) : isVideo ? (
                <div className="cursor-pointer" onClick={() => window.open(`${API_URL}${fileUrl}`, '_blank')}>
                    <video 
                        src={`${API_URL}${fileUrl}`}
                        className="rounded-lg max-h-60 w-full object-cover"
                        controls
                    />
                </div>
            ) : (
                <div 
                    className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => window.open(`${API_URL}${fileUrl}`, '_blank')}
                >
                    <div className="text-2xl">
                        {chatApi.getFileIcon(fileInfo.type || '', fileInfo.mimetype || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileInfo.originalName || 'File'}</p>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.abs(now - date) / 36e5;
    if (diff < 1) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (diff < 24) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('vi-VN');
  };

  const getTypingText = () => {
    const typing = typingUsers[currentConversation?.conversationID];
    if (!typing) return '';
    const names = Object.values(typing).filter(Boolean);
    if (names.length === 1) return `${names[0]} đang gõ...`;
    if (names.length === 2) return `${names[0]} và ${names[1]} đang gõ...`;
    return `${names.length} người đang gõ...`;
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.participants?.some(p => 
      p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // === RENDER MESSAGE ===
  const renderMessage = (message, index) => {
    const currentUserId = user?.userID || user?.id;
    const senderId = message.senderID || message.senderId || message.SenderID;
    const isOwn = String(senderId) === String(currentUserId);
    const content = message.Content || message.content || '';
    const time = message.createdAt || message.timestamp || '';
    const type = message.Type || message.type || 'text';
    const timeStr = formatMessageTime(time);
    const isDeleted = message.isDeleted;
    const deleteForEveryone = message.deleteForEveryone;
    const isEdited = message.isEdited;
    const editedTime = message.editedAt;

    if (isDeleted) {
      let messageText = '';
      
      if (deleteForEveryone) {
        messageText = 'Tin nhắn đã bị xóa';
      } else {
        if (isOwn) {
          messageText = 'Bạn đã xóa tin nhắn này';
        } else {
          messageText = 'Tin nhắn đã bị thu hồi';
        }
      }

      if (isOwn) {
        return (
          <div key={message.messageID || index} className="flex justify-end mb-1">
            <div className="flex max-w-xs md:max-w-md">
              <div className="bg-gray-100 px-4 py-2 rounded-2xl italic text-gray-500 text-sm">
                {messageText}
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div key={message.messageID || index} className="flex justify-start mb-1">
            <div className="flex max-w-xs md:max-w-md">
              <div className="w-10 h-10 mr-2 flex-shrink-0" />
              <div className="bg-gray-100 px-4 py-2 rounded-2xl italic text-gray-500 text-sm">
                {messageText}
              </div>
            </div>
          </div>
        );
      }
    }

    if (isOwn) {
      return (
        <div 
          key={message.messageID || index} 
          className="flex justify-end mb-3 group"
          onContextMenu={(e) => handleLongPress(message, e)}
        >
          <div className="max-w-xs md:max-w-md relative">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-sm shadow-sm flex flex-col">
              {type === 'file' ? renderFileMessage(message) : (
                <p className="text-sm break-words">{content}</p>
              )}
              <div className="flex items-center justify-end space-x-2 mt-1">
                {isEdited && (
                  <span className="text-xs text-blue-100 opacity-90 italic">đã chỉnh sửa</span>
                )}
                <span className="text-xs text-blue-100 opacity-90">{timeStr}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];
    const isFirstInGroup = !prevMessage || 
      String(prevMessage.senderID || prevMessage.senderId) !== String(senderId);
    const isLastInGroup = !nextMessage || 
      String(nextMessage.senderID || nextMessage.senderId) !== String(senderId);

    let roundedClass = '';
    if (isFirstInGroup && isLastInGroup) {
      roundedClass = 'rounded-2xl';
    } else if (isFirstInGroup) {
      roundedClass = 'rounded-t-2xl rounded-b-md';
    } else if (isLastInGroup) {
      roundedClass = 'rounded-b-2xl rounded-t-md';
    } else {
      roundedClass = 'rounded-md';
    }

    return (
      <div 
        key={message.messageID || index} 
        className="flex justify-start mb-1 group"
      >
        <div className="flex max-w-xs md:max-w-md">
          {isLastInGroup ? (
            <div className="w-10 h-10 mr-2 flex-shrink-0">
              <Avatar 
                src={message.senderAvatar || message.avatar} 
                alt={message.senderName || message.senderUsername} 
                size="small"
              />
            </div>
          ) : (
            <div className="w-10 h-10 mr-2 flex-shrink-0" />
          )}

          <div className="flex-1">
            <div className={`bg-gray-100 px-4 py-2 ${roundedClass} shadow-sm flex flex-col`}>
              {type === 'file' ? renderFileMessage(message) : (
                <p className="text-sm break-words text-gray-800">{content}</p>
              )}
              <div className="flex items-center justify-end space-x-2 mt-1">
                {isEdited && (
                  <span className="text-xs text-gray-500 italic">đã chỉnh sửa</span>
                )}
                <span className="text-xs text-gray-500">{timeStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // === CLOSE USER SEARCH MODAL ===
  const closeUserSearchModal = () => {
    setShowUserSearch(false); 
    setUserSearchTerm(''); 
    setSearchUsers([]);
    setCreatingConversations({});
  };

  return (
    <div className="flex h-screen max-h-screen bg-gray-50 overflow-hidden rounded-lg shadow-lg mx-2 mt-4 mb-2">
      <div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-xs font-medium z-50 ${
      isConnected 
        ? 'bg-green-100 text-green-800 border border-green-300' 
        : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
    }`}>
      {isConnected ? '🟢 Đã kết nối' : '🟡 Đang kết nối...'}
    </div>

      {/* Hidden file input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        multiple 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="image/*,video/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />

      {/* Sidebar */}
      <div className={`${isMobileView ? 'w-full' : 'w-1/3'} bg-white border-r border-gray-200 flex flex-col ${isMobileView && !showConversations ? 'hidden' : 'flex'}`}>
        <div className="p-2 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold text-gray-900">Tin nhắn</h1>
            <div className="flex space-x-1">
              <button onClick={() => setShowUserSearch(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <PlusIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setShowCreateGroup(true)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <UserGroupIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-3 text-center text-gray-500 text-sm">Đang tải...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-sm">Không có cuộc trò chuyện</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.conversationID}
                  onClick={() => selectConversation(conv)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${currentConversation?.conversationID === conv.conversationID ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      {conv.type === 'group' ? (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserGroupIcon className="w-6 h-6 text-blue-600" />
                        </div>
                      ) : (
                        <Avatar src={conv.avatar} alt={conv.title} size="medium" />
                      )}
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{conv.title || 'Cuộc trò chuyện'}</h3>
                        <span className="text-xs text-gray-500">{conv.lastMessageTime && formatMessageTime(conv.lastMessageTime)}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">{conv.lastMessageContent || 'Chưa có tin nhắn'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className={`flex-1 flex flex-col min-h-0 ${isMobileView && showConversations ? 'hidden' : 'flex'}`} key={currentConversation?.conversationID}>
        {currentConversation ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
              {isMobileView && (
                <button onClick={() => setShowConversations(true)} className="p-2 hover:bg-gray-100 rounded-full">
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="flex items-center space-x-3 flex-1">
                <Avatar src={currentConversation.avatar} alt={currentConversation.title} size="medium" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900 truncate block">{currentConversation.title}</span>
                  <span className="text-sm text-green-500 block">Đang hoạt động</span>
                </div>
              </div>
              <div className="flex space-x-2">
                {/* CALL BUTTONS - SỬ DỤNG STATE TỪ CALLCONTEXT */}
                <button 
                  onClick={startAudioCall} 
                  disabled={isMakingCall || call} 
                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
                >
                  <PhoneIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={startVideoCall} 
                  disabled={isMakingCall || call} 
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full disabled:opacity-50"
                >
                  <VideoCameraIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Typing Indicator */}
            {getTypingText() && (
              <div className="px-4 py-1 bg-gray-50 border-b border-gray-200">
                <p className="text-xs text-gray-500 italic">{getTypingText()}</p>
              </div>
            )}

            {/* Messages Area */}
            <div 
              className="flex-1 overflow-y-auto p-4 bg-gray-50" 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
            >
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <button onClick={openFilePicker} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full">
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={newMessage}
                  onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageHandler(); }}}
                  placeholder="Aa"
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full">
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={sendMessageHandler} 
                  disabled={!newMessage.trim() || sendingMessage}
                  className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="w-5 h-5 transform rotate-45" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserGroupIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn một cuộc trò chuyện</h3>
              <p className="text-gray-500 text-sm">Chọn từ danh sách hoặc bắt đầu mới</p>
            </div>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {showFilePreview && selectedFiles.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Gửi file ({selectedFiles.length})</h3>
              <button 
                onClick={cancelFileSend}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="text-2xl">
                    {file.type.startsWith('image/') ? '🖼️' : 
                    file.type.startsWith('video/') ? '🎥' : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {chatApi.formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={cancelFileSend}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={() => sendFileMessage(selectedFiles)}
                disabled={sendingMessage}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {sendingMessage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Đang gửi...
                  </>
                ) : (
                  `Gửi ${selectedFiles.length} file`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {editingMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Chỉnh sửa tin nhắn</h3>
              <button 
                onClick={cancelEditMessage}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <textarea
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  updateMessage();
                }
                if (e.key === 'Escape') {
                  cancelEditMessage();
                }
              }}
              placeholder="Nhập nội dung mới..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows="3"
            />
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                Nhấn Ctrl + Enter để gửi, Esc để hủy
              </span>
              <span className="text-xs text-gray-500">
                {editText.length}/1000
              </span>
            </div>
            
            <div className="flex space-x-3 mt-4">
              <button 
                onClick={cancelEditMessage}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={updateMessage}
                disabled={!editText.trim() || editText.trim() === (editingMessage?.Content || editingMessage?.content) || updatingMessage}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {updatingMessage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Đang cập nhật...
                  </>
                ) : (
                  'Cập nhật'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Menu */}
      {showDeleteMenu && longPressedMessage && (
        <div 
          ref={deleteMenuRef}
          className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteMenu(false)}
        >
          <div className="bg-white rounded-xl p-4 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="space-y-2">
              {String(longPressedMessage?.senderID || longPressedMessage?.senderId) === String(user?.userID || user?.id) && 
               longPressedMessage?.Type !== 'file' && longPressedMessage?.type !== 'file' && (
                <button
                  onClick={() => startEditMessage(longPressedMessage)}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  Chỉnh sửa
                </button>
              )}
              
              <button
                onClick={() => deleteMessage(longPressedMessage.messageID, false)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                disabled={deletingMessage}
              >
                <TrashIcon className="w-4 h-4" />
                Xóa cho tôi
              </button>
              
              {String(longPressedMessage?.senderID || longPressedMessage?.senderId) === String(user?.userID || user?.id) && (
                <button
                  onClick={() => deleteMessage(longPressedMessage.messageID, true)}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                  disabled={deletingMessage}
                >
                  <TrashIcon className="w-4 h-4" />
                  Xóa cho mọi người
                </button>
              )}
              
              <button
                onClick={() => setShowDeleteMenu(false)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Tìm người dùng</h3>
              <button 
                onClick={closeUserSearchModal}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm người dùng..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-60 overflow-y-auto">
              {searchingUsers ? (
                <div className="text-center py-4 text-gray-500">Đang tìm kiếm...</div>
              ) : searchUsers.length === 0 && userSearchTerm ? (
                <div className="text-center py-4 text-gray-500">Không tìm thấy</div>
              ) : (
                searchUsers.map(user => {
                  const isCreating = creatingConversations[user.userID];
                  return (
                    <div 
                      key={user.userID} 
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <Avatar src={user.avatar} alt={user.fullName} size="medium" />
                        <div>
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleStartConversation(user)}
                        disabled={isCreating}
                        className={`ml-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          isCreating 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isCreating ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            <span>Đang tạo...</span>
                          </>
                        ) : (
                          <>
                            <PaperAirplaneIcon className="w-3 h-3 transform rotate-45" />
                            <span>Nhắn tin</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Tạo nhóm</h3>
              <button 
                onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedUsers([]); }} 
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Tên nhóm..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} placeholder="Tìm thành viên..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <span key={u.userID} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {u.fullName}
                      <button onClick={() => setSelectedUsers(prev => prev.filter(x => x.userID !== u.userID))} className="text-blue-600 hover:text-blue-700">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                {searchUsers.filter(u => !selectedUsers.some(s => s.userID === u.userID)).map(u => (
                  <div key={u.userID} onClick={() => setSelectedUsers(prev => [...prev, u])} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <Avatar src={u.avatar} alt={u.fullName} size="medium" />
                    <div>
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-sm text-gray-500">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedUsers([]); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                <button onClick={createGroupConversation} disabled={!groupName.trim() || selectedUsers.length === 0 || creatingGroup} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {creatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Modal - SỬ DỤNG CALLCONTEXT */}
      {isReceivingCall && call && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center w-full max-w-sm shadow-2xl">
            <Avatar 
              src={call.initiatorPicture || call.initiatorAvatar} 
              alt={call.initiatorName} 
              size="xl" 
              className="mx-auto mb-3" 
            />
            <h3 className="text-lg font-semibold mb-2">{call.initiatorName}</h3>
            <p className="text-gray-500 mb-6">
              {callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
            </p>
            <div className="flex space-x-4">
              <button 
                onClick={rejectCall} 
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Từ chối
              </button>
              <button 
                onClick={answerCall} 
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Trả lời
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call interface - SỬ DỤNG CALLCONTEXT */}
      {(call && callStatus === 'ongoing') && (
        <CallInterface 
          isVideoCall={callType === 'video'}
          // Không cần truyền call và onEndCall vì CallInterface tự lấy từ Context
        />
      )}
    </div>
  );
};

export default Chat;