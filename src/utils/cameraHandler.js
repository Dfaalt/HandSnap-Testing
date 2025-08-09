import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import * as tf from "@tensorflow/tfjs";
import { toast } from "react-toastify";
import {
  logGestureResponse,
  logTransferSpeedMBps,
  logTransferLatency,
} from "../utils/performanceLogger";
// 🎯 Fungsi untuk menggambar hasil deteksi ke canvas output
const drawResultsToCanvas = (results, canvasRef) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  ctx.save(); // Simpan state canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Bersihkan canvas
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height); // Tampilkan kamera

  // Gambar landmark tangan jika ada
  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks) => {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });
      drawLandmarks(ctx, landmarks, {
        color: "#FF0000",
        lineWidth: 1,
      });
    });
  }

  ctx.restore(); // Kembalikan state canvas
};

// Cek cooldown gesture biar ga spam
const isCooldown = (key, interval) => {
  if (!window.cooldowns) window.cooldowns = {};
  const now = Date.now();
  if (!window.cooldowns[key]) window.cooldowns[key] = 0;

  if (now - window.cooldowns[key] < interval) {
    return true; // masih cooldown
  }

  window.cooldowns[key] = now;
  return false; // boleh lanjut
};

// ✌️ Tangani gesture "SS" (screenshot)
const handleGestureSS = ({
  playSound,
  setShowFlash,
  screenStream,
  screenshotFromStreamAndUpload,
}) => {
  // Cooldown gestur SS
  if (isCooldown("ss", 2500)) return;

  playSound("SS");

  // Tampilkan animasi flash
  if (setShowFlash) {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 400);
  }

  // Jika screen stream aktif, ambil screenshot dari stream
  if (screenStream) {
    const start = performance.now();
    screenshotFromStreamAndUpload(screenStream).then(() => {
      logGestureResponse(start, "SS");
    });
  } else {
    console.warn(
      "❌ screenStream tidak tersedia, tidak dapat mengambil screenshot."
    );
    toast.warn(
      "Enable screen share by clicking 'Start Detection' to take a screenshot!",
      {
        autoClose: 3000,
        position: "top-center",
      }
    );
  }
};

// 🖐 Tangani gesture "transfer_SS" (paste + download)
const handleGestureTransfer = async ({
  fetchLastScreenshot,
  playSound,
  setImageUrl,
  setPasteEffect,
  setDetectedClass,
}) => {
  const now = performance.now();
  // Cooldown gesture transfer_SS
  if (isCooldown("transfer_ss", 2500)) return;

  const start = performance.now(); // ⏱️ mulai timer latency
  // Mode fetch-only: langsung ambil screenshot terakhir dari server
  fetchLastScreenshot(async (imageUrl) => {
    if (!imageUrl) {
      setDetectedClass("❌ Belum ada screenshot.");
      return;
    }

    try {
      const blob = await fetch(imageUrl).then((res) => res.blob());
      const totalTime = performance.now() - start; // milidetik

      // ✅ Logging performa
      logTransferLatency(start);
      logGestureResponse(now, "transfer_SS");
      logTransferSpeedMBps(blob, totalTime);

      // 🔔 Aksi visual dan audio
      playSound("transfer_SS");
      setImageUrl(imageUrl);
      toast.success("Transfer successful! File downloaded.", {
        autoClose: 2000,
      });

      if (setPasteEffect) {
        setPasteEffect(true);
        setTimeout(() => setPasteEffect(false), 800);
      }

      // 💾 Auto-download file
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = "screenshot.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, 500);
    } catch (err) {
      console.error("❌ Gagal fetch gambar:", err);
      toast.error(
        "Oops! Gagal terhubung ke server untuk mengambil screenshot."
      );
    }
  });
};

// 🎥 Fungsi utama untuk mengatur kamera dan deteksi tangan
export const setupCamera = ({
  cameraActive,
  setDetectedClass,
  setConfidence,
  setImageUrl,
  videoRef,
  canvasRef,
  handPresenceRef,
  cameraInstance,
  model,
  labels,
  screenStream,
  playSound,
  screenshotFromStreamAndUpload,
  fetchLastScreenshot,
  setShowFlash,
  setPasteEffect,
}) => {
  if (!model) return; // Model belum siap

  // ✅ Start kamera jika aktif dan belum jalan
  if (cameraActive && !cameraInstance.current) {
    // Inisialisasi MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    const sequenceBuffer = []; // Buffer untuk menyimpan 10 frame terakhir
    const SEQUENCE_LENGTH = 10; // Panjang sequence yang dibutuhkan model
    let lastGesture = null; // Untuk menyimpan gesture terakhir yang terdeteksi
    let lastTriggerTime = 0; // Timestamp saat gesture terakhir dieksekusi
    const GESTURE_COOLDOWN = 1500; // Waktu jeda antar gesture (dalam ms)

    // Filter unknown gesture
    const ALLOWED = new Set(["SS", "transfer_SS"]); // gesture yang boleh eksekusi
    const CONF_THRESHOLD = 0.85; // minimal confidence (0..1)
    const MARGIN_THRESHOLD = 0.25; // selisih top1 - top2

    // Event handler utama saat MediaPipe mengeluarkan hasil
    hands.onResults((results) => {
      const landmarks = results.multiHandLandmarks?.[0]; // Ambil landmark tangan pertama

      if (landmarks) {
        // set ONCE saat tangan baru terdeteksi
        if (!handPresenceRef.current) {
          handPresenceRef.current = true;
          setDetectedClass("Detecting gesture..."); // ← bacaan saat gestur terdeteksi
          setConfidence("");
        }

        if (handPresenceRef.current) {
          // Ambil data x, y, z dari setiap landmark dan datarkan
          const inputData = landmarks.flatMap((lm) => [lm.x, lm.y, lm.z]);
          sequenceBuffer.push(inputData); // Tambahkan ke buffer

          if (sequenceBuffer.length > SEQUENCE_LENGTH) {
            sequenceBuffer.shift(); // Jaga agar buffer hanya berisi 10 frame terakhir
          }

          if (sequenceBuffer.length === SEQUENCE_LENGTH) {
            const inputTensor = tf.tensor([sequenceBuffer]); // Bentuk tensor [1, 10, 63]
            const prediction = model.predict(inputTensor); // Prediksi menggunakan model

            prediction.data().then((predArr) => {
              const maxIndex = predArr.indexOf(Math.max(...predArr)); // Cari index prediksi tertinggi
              const gesture = labels[maxIndex]; // Ambil nama gestur dari label
              const confidence = (predArr[maxIndex] * 100).toFixed(2); // Hitung persentase confidence

              // Hitung top2 & margin
              const scored = predArr
                .map((p, i) => ({ p, i }))
                .sort((a, b) => b.p - a.p);
              const top1 = scored[0];
              const top2 = scored[1] || { p: 0 };
              const conf01 = top1.p; // 0..1
              const margin = top1.p - top2.p; // 0..1

              // Gate UNKNOWN / tidak diizinkan
              if (
                !ALLOWED.has(gesture) ||
                gesture === "UNKNOWN" ||
                conf01 < CONF_THRESHOLD ||
                margin < MARGIN_THRESHOLD
              ) {
                setDetectedClass("Unknown gesture");
                setConfidence(""); // sembunyikan angka biar gak misleading
                // opsional: bersihin buffer biar gak kebawa ke frame berikutnya
                sequenceBuffer.length = 0;
                // jangan eksekusi apa pun
                return;
              }

              const now = Date.now(); // Ambil waktu sekarang
              const gestureChanged = gesture !== lastGesture; // Apakah gestur baru berbeda dari sebelumnya

              if (gestureChanged) {
                // Jika gestur berubah dari sebelumnya, kosongkan buffer
                sequenceBuffer.length = 0;
                lastGesture = gesture;
                return; // Jangan jalankan gesture apapun, tunggu sampai gesture stabil
              }

              setConfidence(confidence); // Tampilkan confidence secara real-time
              if (now - lastTriggerTime > GESTURE_COOLDOWN) {
                setDetectedClass(`Class: ${gesture}`); // Tampilkan nama kelas gesture

                lastTriggerTime = now; // Simpan waktu trigger terakhir

                // Jika gesture adalah "SS" dan belum pernah copy sebelumnya, jalankan screenshot
                if (gesture === "SS") {
                  handleGestureSS({
                    playSound,
                    setShowFlash,
                    screenStream,
                    screenshotFromStreamAndUpload,
                    videoRef,
                  });
                }

                // Jika gesture adalah "transfer_SS", jalankan proses paste
                if (gesture === "transfer_SS") {
                  handleGestureTransfer({
                    fetchLastScreenshot,
                    playSound,
                    setImageUrl,
                    setPasteEffect,
                    setDetectedClass,
                  });
                }

                // Kosongkan buffer setelah gesture dijalankan agar tidak dobel trigger
                sequenceBuffer.length = 0;
              }
            });

            inputTensor.dispose(); // Bersihkan tensor dari memori
          }
        }
      } else {
        // Jika tidak ada tangan terdeteksi, reset semua state terkait deteksi
        handPresenceRef.current = false;
        setDetectedClass("No gesture detected");
        setConfidence("");
        sequenceBuffer.length = 0;
        lastGesture = null;
      }

      // Gambar hasil landmark ke canvas
      drawResultsToCanvas(results, canvasRef);
    });

    // 🔁 Jalankan kamera
    const cam = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    cam.start();
    cameraInstance.current = { cam, hands }; // Simpan instance kamera
  }

  // 🛑 Hentikan kamera jika tidak aktif
  if (!cameraActive && cameraInstance.current) {
    cameraInstance.current.cam.stop(); // Stop MediaPipe camera
    cameraInstance.current = null;
  }
};
