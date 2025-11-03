
const isNgrok = window.location.hostname.includes('ngrok');

export const API_URL = isNgrok 
  ? window.location.origin 
  : 'http://localhost:8080';
// Socket.IO configuration
export const SOCKET_URL = API_URL;

// Other app configuration
export const APP_CONFIG = {
  defaultAvatar: '/assets/default-avatar.png',
  maxFileUploadSize: 5 * 1024 * 1024, // 5MB
  supportedFileTypes: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm'],
    audio: ['audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg']
  }
}; 
