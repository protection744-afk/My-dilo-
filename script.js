const socket = io("https://01-video-streaming-server.glitch.me"); 

const videoDisplay = document.getElementById('videoDisplay');
const roomIdInput = document.getElementById('roomId');
const statusBox = document.getElementById('statusBox');
const cameraBtn = document.getElementById('cameraBtn');
const viewerBtn = document.getElementById('viewerBtn');

let localStream;
let peerConnection;

// إعدادات WebRTC مع سيرفرات Google STUN مجانية لتسهيل الاتصال
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// 1️⃣ كود وضع الكاميرا (المُرسِل)
cameraBtn.addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert("يرجى إدخال كود الغرفة أولاً!");
        return;
    }

    statusBox.innerText = "الحالة: جاري فتح الكاميرا...";

    try {
        // فتح الكاميرا الخلفية والميكروفون
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: true
        });

        videoDisplay.srcObject = localStream;
        statusBox.innerText = `الحالة: الكاميرا تعمل. بانتظار الشاشة (كود: ${roomId})`;

        // الانضمام للغرفة
        socket.emit('join-room', roomId);

        // عند انضمام جهاز شاشة آخر
        socket.on('user-connected', async () => {
            statusBox.innerText = "الحالة: تم الاتصال بالشاشة! جاري بث الفيديو...";
            
            peerConnection = new RTCPeerConnection(rtcConfig);

            // إضافة مسارات الفيديو والصوت (تم تصحيح القوس هنا)
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track);
            });

            // إرسال إشارات الربط (ICE Candidates)
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', { roomId, candidate: event.candidate });
                }
            };

            // إنشاء العرض (Offer)
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', { roomId, offer });
        });

        // استقبال الرد من الشاشة
        socket.on('answer', async (data) => {
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        socket.on('ice-candidate', (data) => {
            if (peerConnection && data.candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

    } catch (err) {
        console.error(err);
        statusBox.innerText = "الحالة: فشل الوصول للكاميرا!";
        alert("يرجى إعطاء صلاحية الكاميرا والميكروفون.");
    }
});

// 2️⃣ كود وضع الشاشة (المستقبل)
viewerBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert("يرجى إدخال كود الغرفة أولاً!");
        return;
    }

    statusBox.innerText = `الحالة: جاري الاتصال بالغرفة (${roomId})...`;
    videoDisplay.muted = false; // تشغيل الصوت للشاشة

    socket.emit('join-room', roomId);

    peerConnection = new RTCPeerConnection(rtcConfig);

    // استقبال البث المباشر وعرضه
    peerConnection.ontrack = (event) => {
        statusBox.innerText = "الحالة: متصل! يتم استقبال البث الحي الآن ✅";
        videoDisplay.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId, candidate: event.candidate });
        }
    };

    // استقبال العرض من الكاميرا والرد عليه
    socket.on('offer', async (data) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
    });

    socket.on('ice-candidate', (data) => {
        if (peerConnection && data.candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
});

