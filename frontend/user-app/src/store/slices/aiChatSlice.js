// File: aiChatSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // 🟢 ĐÃ THÊM

// --- Cấu hình API và Tin nhắn khởi tạo ---
const API_ENDPOINT = 'http://localhost:8080/api/ai/chat';
const initialAssistantMessage = {
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI. Hãy đặt câu hỏi để tôi hỗ trợ.'
};

// --- HÀM HELPER: Lấy UserID (Cần thiết cho lưu/tải) ---
const TOKEN_KEY = 'token';
const getUserIdFromToken = () => {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('authToken');
    if (!token) return null;
    try {
        const decoded = jwtDecode(token);
        return String(decoded.id || decoded.user_id || decoded.sub || '');
    } catch (err) {
        // console.error('Invalid token', err); // Tắt log lỗi token cũ
        return null;
    }
};

// --- Hàm Persistence (Lưu/Tải trạng thái theo UserID) ---

const loadInitialState = () => {
    const userId = getUserIdFromToken(); // 🟢 Lấy UserID HIỆN TẠI

    let defaultState = {
        conversations: [],
        activeConversationId: null,
        currentMessages: [initialAssistantMessage],
        currentUserId: userId, // 🟢 Thêm ID user hiện tại vào state
        loading: false,
        error: null,
    };

    if (!userId) {
        return defaultState; // Trả về mặc định nếu không đăng nhập
    }

    try {
        // 🟢 Tải dữ liệu theo UserID
        const savedConversations = JSON.parse(localStorage.getItem(`chatConversations_user_${userId}`) || '[]');
        const savedActiveId = localStorage.getItem(`activeConversationId_user_${userId}`);

        let currentMessages = [initialAssistantMessage];
        let activeConversationId = null;

        if (savedActiveId && savedConversations.length > 0) {
            const activeConv = savedConversations.find(c => String(c.id) === String(savedActiveId));
            if (activeConv) {
                currentMessages = activeConv.messages || [initialAssistantMessage];
                activeConversationId = savedActiveId;
            }
        }

        return {
            conversations: savedConversations,
            activeConversationId: activeConversationId,
            currentMessages: currentMessages,
            currentUserId: userId, // 🟢 Đảm bảo state biết nó của user nào
            loading: false,
            error: null,
        };
    } catch (e) {
        console.error("Lỗi tải trạng thái từ LocalStorage:", e);
        return defaultState;
    }
};

// Hàm lưu trạng thái vào LocalStorage (Theo UserID)
export const saveStateToLocalStorage = (state) => {
    const userId = state.currentUserId; // 🟢 Lấy UserID TỪ STATE
    if (!userId) return; // Không lưu nếu không đăng nhập

    try {
        const stateToSave = {
            conversations: state.conversations,
            activeConversationId: state.activeConversationId
        };

        localStorage.setItem(`chatConversations_user_${userId}`, JSON.stringify(stateToSave.conversations));

        if (stateToSave.activeConversationId) {
            localStorage.setItem(`activeConversationId_user_${userId}`, stateToSave.activeConversationId);
        } else {
            localStorage.removeItem(`activeConversationId_user_${userId}`);
        }

    } catch (e) {
        console.error("Lỗi lưu trạng thái vào LocalStorage:", e);
    }
};

const loadedState = loadInitialState();

// 🚀 ASYNC THUNK ACTIONS
export const sendAIMessage = createAsyncThunk(
    'aiChat/sendMessage',
    async (latestUserMessageContent, { getState, rejectWithValue }) => {
        const state = getState();
        const { currentMessages } = state.aiChat;

        const newUserMessage = {
            role: 'user',
            content: latestUserMessageContent,
            timestamp: new Date().toISOString()
        };
        const fullMessagesList = [...currentMessages, newUserMessage];

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) {
                return rejectWithValue("Người dùng chưa xác thực. Vui lòng đăng nhập lại.");
            }

            const response = await axios.post(API_ENDPOINT, {
                messages: fullMessagesList
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            return response.data; // Trả về aiMessage

        } catch (error) {
            console.error("Lỗi gửi tin nhắn AI:", error.response?.data || error.message);
            // Sửa lỗi trả về Object (Luôn trả về string)
            let errorString = "Lỗi máy chủ không xác định.";
            if (error.response) {
                if (error.response.status === 403) {
                    errorString = "Lỗi xác thực. Vui lòng đăng nhập lại.";
                } else if (error.response.data && error.response.data.message) {
                    errorString = error.response.data.message;
                } else if (typeof error.response.data === 'string') {
                    errorString = error.response.data;
                } else {
                    errorString = error.message;
                }
            } else if (error.request) {
                errorString = "Không thể kết nối đến máy chủ.";
            } else {
                errorString = error.message;
            }
            return rejectWithValue(errorString);
        }
    }
);


// 📦 REDUX SLICE
const aiChatSlice = createSlice({
    name: 'aiChat',
    initialState: loadedState, // 🟢 initialState đã chứa (hoặc không) dữ liệu
    reducers: {
        // --- 🟢 ACTION KIỂM TRA USER MỚI ---
        checkUserSession: (state) => {
            const currentBrowserUserId = getUserIdFromToken();

            // Nếu user trong state (ví dụ User A) khác user trong token (ví dụ User B)
            if (state.currentUserId !== currentBrowserUserId) {
                // Tải lại toàn bộ state cho user mới
                const newState = loadInitialState();
                state.conversations = newState.conversations;
                state.activeConversationId = newState.activeConversationId;
                state.currentMessages = newState.currentMessages;
                state.currentUserId = newState.currentUserId; // 🟢 Cập nhật ID mới
                state.loading = false;
                state.error = null;
            }
        },

        // --- LOGIC CẬP NHẬT CONVERSATION NỘI BỘ ---
        _saveCurrentConversation: (state) => {
            const msgs = state.currentMessages;
            if (!msgs.some(m => m.role === 'user')) return; // Chỉ lưu nếu có tin nhắn user

            const getTitle = (m) => {
                const firstUser = m.find(msg => msg.role === 'user');
                if (!firstUser) return "New Chat";
                const title = firstUser.content.substring(0, 30);
                return title.length < firstUser.content.length ? `${title}...` : title;
            };

            const newUpdatedAt = new Date().toISOString();

            if (state.activeConversationId) {
                const index = state.conversations.findIndex(c => String(c.id) === String(state.activeConversationId));
                if (index !== -1) {
                    state.conversations[index] = { ...state.conversations[index], messages: msgs, updatedAt: newUpdatedAt, title: getTitle(msgs) };
                }
            } else {
                const newConv = { id: Date.now().toString(), title: getTitle(msgs), messages: msgs, createdAt: newUpdatedAt, updatedAt: newUpdatedAt };
                state.conversations.unshift(newConv);
                state.activeConversationId = newConv.id;
            }
        },

        // --- LOGIC QUẢN LÝ TÍNH NĂNG ---
        createNewChat: (state) => {
            aiChatSlice.caseReducers._saveCurrentConversation(state); // Lưu chat cũ
            state.currentMessages = [initialAssistantMessage];
            state.activeConversationId = null;
            state.loading = false;
            state.error = null;
            saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
        },

        switchConversation: (state, action) => {
            const newActiveId = action.payload;
            aiChatSlice.caseReducers._saveCurrentConversation(state); // Lưu chat cũ

            const newConv = state.conversations.find(c => String(c.id) === String(newActiveId));
            if (newConv) {
                state.currentMessages = newConv.messages || [initialAssistantMessage];
                state.activeConversationId = newActiveId;
            } else {
                state.currentMessages = [initialAssistantMessage];
                state.activeConversationId = null;
            }
            state.loading = false;
            state.error = null;
            saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
        },

        deleteConversation: (state, action) => {
            const idToDelete = action.payload;
            state.conversations = state.conversations.filter(c => String(c.id) !== String(idToDelete));

            if (String(idToDelete) === String(state.activeConversationId)) {
                state.currentMessages = [initialAssistantMessage];
                state.activeConversationId = null;
            }
            saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
        },

        clearAllHistory: (state) => {
            state.conversations = [];
            state.activeConversationId = null;
            state.currentMessages = [initialAssistantMessage];
            state.loading = false;
            state.error = null;

            const userId = state.currentUserId; // Dùng ID từ state
            if (userId) {
                localStorage.removeItem(`chatConversations_user_${userId}`);
                localStorage.removeItem(`activeConversationId_user_${userId}`);
            }
        },

        clearChatError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // sendAIMessage - Pending
            .addCase(sendAIMessage.pending, (state, action) => {
                state.loading = true;
                state.error = null;
                const newUserMessage = { role: 'user', content: action.meta.arg, timestamp: new Date().toISOString() };
                state.currentMessages.push(newUserMessage);

                if (!state.activeConversationId && state.currentMessages.length > 1) {
                    aiChatSlice.caseReducers._saveCurrentConversation(state);
                    saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
                }
            })
            // sendAIMessage - Fulfilled
            .addCase(sendAIMessage.fulfilled, (state, action) => {
                state.loading = false;
                state.currentMessages.push(action.payload); // Thêm tin nhắn AI

                aiChatSlice.caseReducers._saveCurrentConversation(state);
                saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
            })
            // sendAIMessage - Rejected
            .addCase(sendAIMessage.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload; // Đã là string
                state.currentMessages.pop(); // Xóa tin nhắn user vừa thêm
                saveStateToLocalStorage(state); // 🟢 LƯU THAY ĐỔI
            });
    }
});

export const {
    createNewChat,
    switchConversation,
    deleteConversation,
    clearAllHistory,
    clearChatError,
    checkUserSession // 🟢 EXPORT ACTION MỚI
} = aiChatSlice.actions;

export default aiChatSlice.reducer;