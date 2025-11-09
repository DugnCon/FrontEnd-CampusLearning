// File: src/services/aiService.js

import axios from 'axios';

/**
 * Địa chỉ endpoint của Backend Spring Boot
 * Đã chuyển API Chat sang Backend chính (thường là cổng 8080)
 */
const API_URL = 'http://localhost:8080/api/ai/chat';

// --- Khởi tạo (Không gửi request) ---

/**
 * Khởi tạo chat model (Stateless).
 * Hàm này chỉ dùng để báo hiệu Frontend rằng dịch vụ đã sẵn sàng.
 */
export const initChat = async () => {
  console.log("Chat initialized for Stateless Backend (using Session/Cookie).");
  // Trả về một đối tượng giả để AIChat.jsx biết rằng nó đã sẵn sàng.
  return { status: 'ready' };
};

// --- Gửi tin nhắn (Gửi kèm Cookie/Session) ---

/**
 * Gửi toàn bộ lịch sử (mảng messages) đến Backend Spring Boot.
 * 🛑 QUAN TRỌNG: Sử dụng withCredentials để tự động gửi Cookie Session.
 * @param {Array<Object>} messages - Toàn bộ lịch sử trò chuyện (bao gồm tin nhắn user mới nhất).
 * @returns {Promise<Object>} Phản hồi tin nhắn từ AI (đã được định dạng)
 */
export const sendMessage = async (messages) => {
  try {
    // Payload phải là { "messages": [...] } để khớp với DTO ChatRequest của Backend
    const payload = { messages };

    const response = await axios.post(API_URL, payload, {
      // 🛑 BƯỚC CỐT LÕI: Yêu cầu trình duyệt tự động đính kèm Cookie Session
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        // Không cần header Authorization Bearer Token khi dùng Session/Cookie
      }
    });

    // Backend trả về ChatMessage { role: 'assistant', content: '...' }
    // Giả định Backend trả về đối tượng tin nhắn hoàn chỉnh
    return response.data;

  } catch (error) {
    console.error("Error sending message to Backend:", error);

    // Xử lý lỗi kết nối hoặc lỗi HTTP từ Backend
    if (error.response) {

      // Xử lý lỗi 403/401 do Session hết hạn hoặc chưa đăng nhập
      if (error.response.status === 403 || error.response.status === 401) {
        throw new Error("Lỗi xác thực: Vui lòng đăng nhập lại để sử dụng chức năng Chat.");
      }

      const status = error.response.status;
      // Trích xuất thông báo lỗi chi tiết từ Backend nếu có
      const errorContent = error.response.data?.content || `Lỗi HTTP ${status}: Lỗi từ Backend không xác định.`;

      throw new Error(errorContent);

    } else if (error.request) {
      // Lỗi xảy ra khi không thể thiết lập kết nối (ví dụ: Backend đang tắt)
      throw new Error("Lỗi kết nối: Không thể kết nối với dịch vụ Chat AI (Cổng 8080). Vui lòng kiểm tra Server Backend và cấu hình CORS.");
    } else {
      // Lỗi xảy ra trong quá trình thiết lập request
      throw new Error("Lỗi không xác định trong Frontend: " + error.message);
    }
  }
};

export default {
  initChat,
  sendMessage,
};