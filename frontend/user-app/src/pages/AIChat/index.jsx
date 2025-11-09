// File: AIChat.jsx (Sử dụng Redux cho Quản lý Conversations)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import {
    PaperAirplaneIcon,
    ArrowPathIcon,
    PlusIcon,
    SparklesIcon,
    TrashIcon,
    ExclamationCircleIcon,
    ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';

// 🟢 IMPORT TẤT CẢ ACTIONS TỪ SLICE
import {
    sendAIMessage,
    createNewChat,
    switchConversation,
    deleteConversation,
    clearAllHistory,
    clearChatError,
    checkUserSession
} from '../../store/slices/aiChatSlice';

import { initChat } from '../../services/aiService';

// --- HÀM PHỤ TRỢ ---
const TOKEN_KEY = 'token';

// Hàm lấy User ID (Giữ nguyên)
const getUserIdFromToken = () => {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('authToken');
    if (!token) return null;
    try {
        const decoded = jwtDecode(token);
        return String(decoded.id || decoded.user_id || decoded.sub || '');
    } catch (err) {
        console.error('Invalid token', err);
        return null;
    }
};

// 🟢 MẢNG GỢI Ý CÂU HỎI (Đã thêm vào)
const suggestedQuestions = [
    {
        category: "Lập Trình",
        questions: [
            "Giải thích về nguyên tắc SOLID trong lập trình hướng đối tượng?",
            "So sánh giữa JavaScript và TypeScript?",
            "Cách tối ưu hiệu suất cho ứng dụng React?",
            "Phân biệt giữa REST API và GraphQL?"
        ]
    },
    {
        category: "Công Nghệ",
        questions: [
            "Machine Learning là gì và ứng dụng thực tế?",
            "Blockchain hoạt động như thế nào?",
            "Cách bảo mật website từ các cuộc tấn công XSS?",
            "Docker và Kubernetes khác nhau như thế nào?"
        ]
    },
    {
        category: "Mạng & Hệ Thống",
        questions: [
            "Cách khắc phục lỗi mất kết nối Internet?",
            "Cài đặt mạng VPN riêng như thế nào?",
            "So sánh giữa IPv4 và IPv6?",
            "Cấu hình tường lửa cơ bản cho server?"
        ]
    },
];

// 🟢 TIN NHẮN KHỞI TẠO (Đã thêm vào)
const initialAssistantMessage = {
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI. Hãy đặt câu hỏi để tôi hỗ trợ.'
};

const AIChat = () => {

    // 🟢 ĐỌC DỮ LIỆU TỪ REDUX
    const dispatch = useDispatch();
    const {
        currentMessages: messages, // Lấy lịch sử của chat đang hoạt động
        conversations,            // Lấy danh sách toàn bộ conversations
        activeConversationId,     // Lấy ID Conversation đang hoạt động
        loading,
        error: reduxError
    } = useSelector(state => state.aiChat);

    const currentUserId = getUserIdFromToken();
    const [userId, setUserId] = useState(currentUserId);
    const [input, setInput] = useState('');
    const [initializing, setInitializing] = useState(true);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const displayError = reduxError;
    useEffect(() => {
        dispatch(checkUserSession());
    }, [dispatch]); // Chỉ chạy một lần khi component mount

    // --- KHỞI TẠO CHAT VÀ AI SERVICE ---
    useEffect(() => {
        const setupChat = async () => {
            if (!userId){
                setInitializing(false);
                return;
            }
            try {
                await initChat();
            } catch (err) {
                console.error(err);
            } finally {
                setInitializing(false);
            }
        };
        setupChat();
    }, [userId]);

    // --- SCROLL TO BOTTOM ---
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [messages]);

    // 🟢 HÀM XỬ LÝ CHAT (SỬ DỤNG REDUX ACTIONS)
    const handleCreateNewChat = () => {
        dispatch(createNewChat());
    };

    const handleDeleteConversation = (id) => {
        dispatch(deleteConversation(id));
    };

    const handleClearAllHistory = () => {
        if(!userId) return;
        if(!window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat không?')) return;
        dispatch(clearAllHistory());
    };

    const handleSwitchConversation = (id) => {
        if (String(id) === String(activeConversationId)) return;
        dispatch(switchConversation(id) );
    };

    const handleSuggestedQuestion = (question) => {
        if (!userId) {
            dispatch(clearChatError());
            return;
        }
        setInput(question);
        inputRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!input.trim() || !userId || loading || initializing){
            dispatch(clearChatError());
            return;
        }

        dispatch(sendAIMessage(input.trim()) );
        setInput('');
    };

    // --- RENDER MARKDOWN ---
    const renderMessageContent = (content, role) => (
        <ReactMarkdown
            components={{
                p: ({ node, ...props }) => <p className="text-sm leading-relaxed mb-1" {...props} />,
                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-2" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mb-1" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-md font-semibold mb-1" {...props} />,
                table: ({ node, ...props }) => (
                    <table className="border-collapse border border-gray-300 text-sm mb-2" {...props} />
                ),
                thead: ({ node, ...props }) => <thead className="bg-gray-200 font-semibold" {...props} />,
                tbody: ({ node, ...props }) => <tbody {...props} />,
                tr: ({ node, ...props }) => <tr className="border-b border-gray-300" {...props} />,
                th: ({ node, ...props }) => (
                    <th className="border border-gray-300 px-2 py-1 text-left" {...props} />
                ),
                td: ({ node, ...props }) => (
                    <td className="border border-gray-300 px-2 py-1" {...props} />
                ),
                code: ({ node, inline, className, children, ...props }) => (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>{children}</code>
                )
            }}
        >
            {content}
        </ReactMarkdown>
    );

    return (
        <div className="h-[calc(100vh-84px)] flex flex-col md:flex-row bg-white text-gray-950 overflow-hidden">
            {/* Left Sidebar - Chat History */}
            <div className="hidden md:block md:w-64 border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b sticky top-0 bg-white z-10">
                    <button
                        onClick={handleCreateNewChat}
                        className="w-full flex items-center justify-center p-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
                        disabled={!userId}
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Cuộc Trò Chuyện Mới
                    </button>
                    {!userId && <p className="text-xs text-red-500 mt-2 text-center">Đăng nhập để lưu lịch sử chat.</p>}
                </div>

                <div className="p-4">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Lịch Sử</h3>
                    {conversations && conversations.length === 0 ? (
                        <p className="text-sm text-gray-500">Chưa có lịch sử chat.</p>
                    ) : (
                        <ul className="space-y-2">
                            {conversations && conversations.map(conv => (
                                <li
                                    key={conv.id}
                                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${
                                        String(conv.id) === String(activeConversationId)
                                            ? 'bg-indigo-100 text-indigo-700 font-semibold'
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                    onClick={() => handleSwitchConversation(conv.id)}
                                >
                                    <div className="flex-1 truncate">
                                        <ChatBubbleLeftIcon className="w-4 h-4 inline mr-2" />
                                        {conv.title}
                                    </div>
                                    <TrashIcon
                                        className="w-4 h-4 ml-3 text-gray-400 hover:text-red-600"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                    {conversations && conversations.length > 0 && (
                        <button
                            onClick={handleClearAllHistory}
                            className="mt-4 w-full text-xs text-red-500 hover:text-red-700"
                        >
                            Xóa toàn bộ lịch sử
                        </button>
                    )}
                </div>
            </div>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col h-full relative bg-gray-50 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages && messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                            <div className={`max-w-4xl p-3 rounded-xl shadow-md ${
                                msg.role==='user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                            }`}>
                                {msg.role==='assistant' && <SparklesIcon className="w-4 h-4 inline mr-2 text-indigo-500" />}
                                {renderMessageContent(msg.content, msg.role)}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-md border border-gray-200">
                                <span className="flex items-center text-gray-500">
                                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" /> AI đang trả lời...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-200">
                    {displayError && (
                        <div className="mb-3 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
                            <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                            <p className="text-sm">{displayError}</p>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex items-end space-x-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); dispatch(clearChatError()); }}
                            placeholder={!userId ? "Vui lòng đăng nhập..." : "Nhập câu hỏi của bạn..."}
                            className="flex-1 p-3 pr-16 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-100"
                            disabled={loading || initializing || !userId}
                        />
                        <button
                            type="submit"
                            className={`p-3 rounded-xl transition duration-150 shadow-md ${
                                (!input.trim() || loading || !userId) ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                            disabled={!input.trim() || loading || initializing || !userId}
                        >
                            <PaperAirplaneIcon className="w-5 h-5 text-white" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Right Sidebar - Suggested Questions */}
            <div className="hidden md:block md:w-64 border-l border-gray-200 overflow-y-auto bg-gray-50 p-4">
                <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Gợi ý câu hỏi</h3>
                {suggestedQuestions.map((group, idx) => (
                    <div key={idx} className="mb-4">
                        <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">{group.category}</h4>
                        <div className="flex flex-col gap-2">
                            {group.questions.map((q, qIdx) => (
                                <button
                                    key={qIdx}
                                    type="button"
                                    onClick={() => handleSuggestedQuestion(q)}
                                    className="text-left px-2 py-1 bg-gray-200 rounded-lg text-sm hover:bg-gray-300 transition"
                                >
                                    {q.length > 40 ? q.substring(0, 40) + '...' : q}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIChat;