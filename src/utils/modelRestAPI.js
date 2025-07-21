import axios from "axios";
import { toast } from "react-toastify";
import * as tf from "@tensorflow/tfjs";

/**
 * 🧠 Memuat model TensorFlow dari direktori /model di public folder
 * @param {function} setModel - Fungsi setter React untuk menyimpan model ke state
 */
export const loadModel = async (setModel) => {
  try {
    const model = await tf.loadLayersModel("/model/model.json"); // Load model .json dari folder public
    setModel(model); // Simpan model ke state
    console.log("✅ Model loaded!");
  } catch (err) {
    console.error("❌ Failed to load model:", err);
  }
};

// 🔐 Ambil base URL dari .env
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
/**
 * 🖥 Mengambil screenshot dari layar desktop (stream) dan mengunggahnya
 * @param {MediaStream} screenStream - Stream dari getDisplayMedia()
 */
export const screenshotFromStreamAndUpload = async (screenStream) => {
  try {
    if (!screenStream) throw new Error("No screen stream provided");

    const track = screenStream.getVideoTracks()[0]; // Ambil track video dari stream
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame(); // Tangkap frame dari layar

    // Buat canvas baru dengan ukuran bitmap
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0); // Gambar bitmap ke canvas

    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error("Blob tidak tersedia");
      await uploadImage(blob, "screenshot-desktop.webp"); // Upload ke server
      console.log("✅ Desktop screenshot uploaded");
      toast.success("Screenshot successfully!", { autoClose: 2000 });
    }, "image/webp");
  } catch (err) {
    console.warn("⚠️ Tidak dapat mengambil screenshot dari screen stream.");
    toast.error("Gagal mengambil screenshot dari layar.", { autoClose: 3000 });
  }
};

/**
 * 🖼 Mengambil screenshot terakhir dari server dan mengubahnya ke URL object untuk ditampilkan
 * @param {function} setImageUrl - Setter React untuk menyimpan URL blob ke state
 */
export const fetchLastScreenshot = async (setImageUrl) => {
  try {
    const res = await axios.get(`${BASE_URL}/api/image/latest`, {
      timeout: 3000,
      validateStatus: () => true, // Tangani 404 manual
    });

    if (res.status === 404 || !res.data.image_data?.trim()) {
      toast.info("No screenshot data available yet.", { autoClose: 2000 });
      setImageUrl(null);
      return;
    }

    if (res.status !== 200) {
      toast.error(`❌ Server error (${res.status}) fetching image`, {
        autoClose: 3000,
      });
      return;
    }

    const hex = res.data.image_data; // Data dari Flask berupa string heksadesimal
    // Konversi hex string ke array byte
    const binary = hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16));
    const blob = new Blob([new Uint8Array(binary)], { type: "image/webp" });

    const imageUrl = URL.createObjectURL(blob); // Buat URL sementara dari blob
    setImageUrl(imageUrl); // Simpan ke state React
  } catch (err) {
    console.error("❌ Failed to fetch last screenshot:", err);
    toast.error("❌ Failed to transfer image from server (API down)", {
      autoClose: 3000,
    });
  }
};

/**
 * 📤 Utilitas untuk mengunggah file gambar ke endpoint Flask
 * @param {Blob} blob - Objek blob gambar
 * @param {string} filename - Nama file untuk dikirimkan ke server
 */
const uploadImage = async (blob, filename) => {
  const formData = new FormData();
  formData.append("file", blob, filename); // Siapkan form multipart/form-data

  try {
    await axios.post(`${BASE_URL}/api/image/upload`, formData); // POST ke Flask API
  } catch (err) {
    toast.error("❌ Screenshot Failed: server is down.", { autoClose: 3000 });
    throw new Error("❌ Upload error: server is down " + err.message);
  }
};
