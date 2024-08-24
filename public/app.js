// public/app.js
const socket = io();

const roomInput = document.getElementById('roomInput');
const createRoomButton = document.getElementById('createRoom');
const joinRoomButton = document.getElementById('joinRoom');
const roomControls = document.getElementById('roomControls');
const sharingControls = document.getElementById('sharingControls');
const startSharingButton = document.getElementById('startSharing');
const stopSharingButton = document.getElementById('stopSharing');
const sharedScreenVideo = document.getElementById('sharedScreen');
const roomInfoDiv = document.getElementById('roomInfo');

let peerConnection;
let currentStream;
let roomName;
let isSharing = false;

function generateRoomName() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, roomName);
        }
    };

    peerConnection.ontrack = (event) => {
        if (!isSharing) {
            sharedScreenVideo.srcObject = event.streams[0];
        }
    };
}

async function startScreenSharing() {
    try {
        currentStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false
        });

        sharedScreenVideo.srcObject = currentStream;
        isSharing = true;

        currentStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, currentStream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, roomName);

        startSharingButton.disabled = true;
        stopSharingButton.disabled = false;

        currentStream.getVideoTracks()[0].onended = () => {
            stopScreenSharing();
        };
    } catch (error) {
        console.error('Error starting screen share:', error);
    }
}

function stopScreenSharing() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        isSharing = false;
        sharedScreenVideo.srcObject = null;
        startSharingButton.disabled = false;
        stopSharingButton.disabled = true;
        socket.emit('stop-sharing', roomName);
    }
}

function joinRoom(room) {
    roomName = room;
    socket.emit('join', roomName);
    roomInfoDiv.textContent = `Room: ${roomName}`;
    roomControls.style.display = 'none';
    sharingControls.style.display = 'block';
    setupPeerConnection();
}

createRoomButton.addEventListener('click', () => {
    const newRoom = generateRoomName();
    roomInput.value = newRoom;
    joinRoom(newRoom);
});

joinRoomButton.addEventListener('click', () => {
    const room = roomInput.value.trim();
    if (room) {
        joinRoom(room);
    } else {
        alert('Please enter a room name');
    }
});

startSharingButton.addEventListener('click', startScreenSharing);
stopSharingButton.addEventListener('click', stopScreenSharing);

// Handle received offers
socket.on('offer', async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, roomName);
});

// Handle received answers
socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Handle received ICE candidates
socket.on('ice-candidate', async (candidate) => {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Handle stop sharing event
socket.on('stop-sharing', () => {
    sharedScreenVideo.srcObject = null;
});