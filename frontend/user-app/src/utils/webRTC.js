// src/utils/webRTC.js  ← ĐÚNG TÊN, ĐÚNG CHỖ

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN VN cực ngon (ping <40ms)
  { urls: "turn:turn.vietnamdevs.vn:3478", username: "vietnam", credential: "devs2025" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:turn.matrix.one:3478", username: "guest", credential: "guest123" },
];

export const createPeerConnection = (onIceCandidate, onTrack) => {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    onTrack(event.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    console.log("WebRTC state:", pc.connectionState);
    if (pc.connectionState === "failed") {
      console.error("WebRTC kết nối thất bại!");
    }
  };

  return pc;
};

export const getLocalStream = async (audio = true, video = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio,
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
  return stream;
};

export const addTracksToConnection = (pc, stream) => {
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
};

export const createOffer = async (pc) => {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
};

export const createAnswer = async (pc) => {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
};

export const setRemoteDescription = async (pc, desc) => {
  await pc.setRemoteDescription(new RTCSessionDescription(desc));
};

export const addIceCandidate = async (pc, candidate) => {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
};

export const cleanupConnection = (pc, stream) => {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (pc) pc.close();
};