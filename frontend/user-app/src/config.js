
export const API_URL = 'http://campuslearning.site/user/api';
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
