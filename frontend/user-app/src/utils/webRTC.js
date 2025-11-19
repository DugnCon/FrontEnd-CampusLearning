// src/utils/webrtc.js (hoặc tên file mày đang dùng)
let currentSendSignal = null;

/**
 * Set callback để gửi signaling (offer/answer/candidate) qua Socket
 */
export const setSignalCallback = (callback) => {
  currentSendSignal = callback;
};

/**
 * Tạo PeerConnection và gắn sự kiện onicecandidate
 */
export const createPeerConnection = () => {
  const iceConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // TURN server (dùng tạm, production nên thay bằng của mày)
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
      }
    ],
    iceCandidatePoolSize: 10,
  };

  const peerConnection = new RTCPeerConnection(iceConfig);

  // ĐÂY LÀ CHỖ QUAN TRỌNG NHẤT – GẮN SỰ KIỆN TRONG HÀM TẠO
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentSendSignal) {
      currentSendSignal({
        type: 'candidate',
        candidate: event.candidate
      });
    }
  };

  // (Tùy chọn) Log trạng thái kết nối
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
  };

  peerConnection.ontrack = (event) => {
    console.log('Received remote stream');
    // CallContext sẽ xử lý event này
  };

  return peerConnection;
};

// === CÁC HÀM KHÁC GIỮ NGUYÊN ===
// utils/webRTC.js

export const getLocalStream = async (audio = true, video = false) => {
  try {
    console.log("🎤 Requesting media: audio=", audio, "video=", video);
    
    const constraints = {
      audio: audio,
      video: video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("✅ Media obtained:", stream.getAudioTracks().length, "audio,", 
                stream.getVideoTracks().length, "video tracks");
    
    return stream;
  } catch (err) {
    console.error("❌ getLocalStream error:", err.name, err.message);
    throw new Error(`Cannot access microphone/camera: ${err.message}`);
  }
};

export const addTracksToConnection = (peerConnection, stream) => {
  if (!peerConnection || !stream) return;
  stream.getTracks().forEach(track => {
    peerConnection.addTrack(track, stream);
  });
};

export const createOffer = async (peerConnection) => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return offer;
};

export const createAnswer = async (peerConnection) => {
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
};

export const setRemoteDescription = async (peerConnection, description) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
};

export const addIceCandidate = async (peerConnection, candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

export const endCallCleanup = (peerConnection, localStream) => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
    // Không cần gán null các event handler – close() là đủ
  }
};