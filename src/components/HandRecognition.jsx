import React, { useEffect, useRef, useState, useMemo } from "react";
import { playSound } from "../utils/soundManager";
import { toast } from "react-toastify";
import {
  loadModel,
  screenshotFromStreamAndUpload,
  fetchLastScreenshot,
} from "../utils/modelRestAPI";
import { setupCamera } from "../utils/cameraHandler";
import { startFPSLogger, stopFPSLogger } from "../utils/performanceLogger";

const HandRecognition = () => {
  // === STATE ===
  const [model, setModel] = useState(null); // Model TensorFlow
  const [detectedClass, setDetectedClass] = useState(""); // Kelas gesture yang terdeteksi
  const [confidence, setConfidence] = useState(""); // Persentase confidence
  const [cameraActive, setCameraActive] = useState(false); // Status kamera
  const [imageUrl, setImageUrl] = useState(null); // Hasil screenshot dari backend
  const [screenStream, setScreenStream] = useState(null); // Stream dari layar (desktop sharing)
  const [showFlash, setShowFlash] = useState(false); // Flash saat screenshot
  const [pasteEffect, setPasteEffect] = useState(false); // Animasi paste

  // === REF (DOM atau var persist) ===
  const videoRef = useRef(null); // Kamera
  const canvasRef = useRef(null); // Canvas utama untuk deteksi
  const canvasPiPRef = useRef(null); // Canvas untuk Picture-in-Picture
  const cameraInstance = useRef(null); // Instance kamera dari mediapipe/camera
  const copiedRef = useRef(false); // Flag gesture sudah copy
  const pipVideo = useRef(null); // Video element untuk PiP
  const handPresenceRef = useRef(false); // Status apakah tangan terlihat
  const frameCounterRef = useRef(0); // Counter frame tangan

  // === Label gesture ===
  const labels = useMemo(() => ["SS", "transfer_SS"], []);

  // Load model sekali saat mount
  useEffect(() => {
    loadModel(setModel);
    if (cameraActive) {
      startFPSLogger();
    } else {
      stopFPSLogger();
    }
  }, [cameraActive]);

  // Setup kamera dan gesture detection saat model & kamera aktif
  useEffect(() => {
    setupCamera({
      cameraActive,
      setDetectedClass,
      setConfidence,
      setImageUrl,
      videoRef,
      canvasRef,
      cameraInstance,
      copiedRef,
      handPresenceRef,
      frameCounterRef,
      model,
      labels,
      screenStream,
      playSound,
      screenshotFromStreamAndUpload,
      fetchLastScreenshot,
      setShowFlash,
      setPasteEffect,
    });
  }, [model, cameraActive, labels, screenStream]);

  // Gambar mirror (flip horizontal) ke canvasPiP agar tampil di PiP
  const drawMirrorCanvasToPiP = () => {
    const canvas = canvasPiPRef.current;
    const ctx = canvas.getContext("2d");
    const [w, h] = [640, 480];
    canvas.width = w;
    canvas.height = h;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    const drawLoop = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      ctx.drawImage(canvasRef.current, 0, 0, w, h);
      requestAnimationFrame(drawLoop); // Looping terus-menerus
    };
    drawLoop();
  };

  // Aktifkan fitur Picture-in-Picture
  const activatePictureInPicture = async () => {
    const canvasStream = canvasPiPRef.current.captureStream(30);
    pipVideo.current = document.createElement("video");
    pipVideo.current.srcObject = canvasStream;
    await pipVideo.current.play();

    try {
      await pipVideo.current.requestPictureInPicture();
      toast.success("Picture-in-Picture activated!", { autoClose: 3000 });
    } catch (error) {
      console.error("❌ Failed to activate PiP:", error);
      toast.error("Gagal mengaktifkan Picture-in-Picture!", {
        autoClose: 3000,
      });
    }
  };

  // Reset semua state saat klik restart detection
  const resetAllStates = () => {
    copiedRef.current = false; // Reset flag gesture copy
    setDetectedClass(""); // Kosongkan hasil deteksi
    setConfidence(""); // Reset confidence
    setImageUrl(null); // Kosongkan gambar screenshot
    setShowFlash(false); // Hilangkan flash
    setPasteEffect(false); // Reset efek paste
  };

  // Fungsi untuk mulai deteksi kamera + layar
  const handleStartDetection = async () => {
    handleStopDetection(); // Stop dulu kalau sebelumnya aktif

    await new Promise((resolve) => setTimeout(resolve, 300)); // Delay sebentar

    resetAllStates(); // Reset semua state yang penting

    try {
      // Minta izin kamera
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      videoRef.current.srcObject = camStream;
      await videoRef.current.play();

      drawMirrorCanvasToPiP();
      await activatePictureInPicture(); // Aktifkan PiP

      // Minta izin share screen
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenStream(screen);
      setCameraActive(true);
      toast.success("Start detection permission granted!", { autoClose: 3000 });

      // Deteksi jika user menghentikan screen share manual
      screen.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setCameraActive(false);
        toast.info("Screen sharing stopped.", { autoClose: 1500 });
      };
    } catch (err) {
      console.error("Start Detection Failed:", err);
      handleStopDetection();
      toast.error("Start detection permission denied!", { autoClose: 3000 });
    }
  };

  // Fungsi untuk memberhentikan semua stream
  const handleStopDetection = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }

    if (document.pictureInPictureElement) {
      document
        .exitPictureInPicture()
        .catch((err) => console.warn("Keluar PiP gagal:", err));
    }

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    if (pipVideo.current) {
      pipVideo.current.srcObject.getTracks().forEach((t) => t.stop());
      pipVideo.current = null;
    }

    setCameraActive(false);
  };

  // Toggle kamera saja, tanpa share screen
  const toggleCamera = () => {
    setCameraActive((prev) => {
      const newState = !prev;
      toast.dismiss(); // Tutup semua toast sebelumnya

      if (newState) {
        toast.success("Camera started", { autoClose: 1500 });
      } else {
        toast.info("Detection stopped", { autoClose: 1000 });
        handleStopDetection();
        setTimeout(() => {
          window.location.reload(); // 🔁 Refresh halaman total
        }, 1000); // Tunggu toast selesai
      }

      return newState;
    });
  };
  return (
    <div className="container-fluid flex-fill px-3">
      {showFlash && <div className="flash-overlay" />}
      <div className="card bg-dark text-white shadow border-light mb-5">
        <div className="card-body px-4 py-4">
          {/* Video dari kamera (tidak ditampilkan langsung) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="640"
            height="480"
            style={{ display: "none" }}
          />

          {/* Canvas untuk gambar kamera dan PiP */}
          <div className="d-flex flex-wrap justify-content-center align-items-start gap-4">
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              style={{ display: "none" }}
            />
            <canvas ref={canvasPiPRef} style={{ display: "none" }} />
          </div>

          {/* Tombol kontrol */}
          <div className="d-flex justify-content-center gap-3 mb-3">
            <button onClick={handleStartDetection} className="btn btn-success">
              {cameraActive && screenStream
                ? "Restart Detection"
                : "Start Detection"}
            </button>
            <button
              onClick={toggleCamera}
              className={`btn ${cameraActive ? "btn-danger" : "btn-primary"}`}
            >
              {cameraActive ? "Stop Detection" : "Open Camera"}
            </button>
          </div>

          {/* Hasil deteksi dan screenshot */}
          <div className="mt-2 text-center">
            <h4 className="text-info">Detection Result</h4>
            <p className="fs-5 mb-1">{detectedClass}</p>
            <p className="fs-6 text-secondary">Confidence: {confidence}%</p>
            {imageUrl && (
              <div>
                <h5 className="text-light">Screenshot Result:</h5>
                <img
                  src={imageUrl}
                  alt="Screenshot"
                  width="800"
                  height="500"
                  className={`img-thumbnail shadow mb-3 ${
                    pasteEffect ? "paste-animate" : ""
                  }`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandRecognition;
