// src/utils/performanceLogger.js

let fpsInterval;
let frameCount = 0;
let lastTime = Date.now();

/**
 * Mulai hitung FPS dan log per detik
 */
export const startFPSLogger = () => {
  frameCount = 0;
  lastTime = Date.now();

  const loop = () => {
    frameCount++;
    const now = Date.now();
    if (now - lastTime >= 1000) {
      console.log(`[PERFORMANCE] FPS: ${frameCount}`);
      frameCount = 0;
      lastTime = now;
    }
    fpsInterval = requestAnimationFrame(loop);
  };

  loop();
};

/**
 * Stop FPS logging
 */
export const stopFPSLogger = () => {
  cancelAnimationFrame(fpsInterval);
};

/**
 * Log latency transfer file dari awal hingga selesai
 */
export const logTransferLatency = (t0) => {
  const t1 = performance.now();
  const latency = (t1 - t0).toFixed(2);
  console.log(`[PERFORMANCE] Latensi transfer file: ${latency} ms`);
};

/**
 * Log waktu respons gesture dari awal hingga selesai
 */
export const logGestureResponse = (start, label = "Gesture") => {
  const end = performance.now();
  const duration = (end - start).toFixed(2);
  console.log(`[PERFORMANCE] Waktu respons ${label}: ${duration} ms`);
};

/**
 * Hitung kecepatan transfer file dalam MB/s
 */
export const logTransferSpeedMBps = (blob, timeInMs) => {
  if (!blob || !timeInMs) return;
  const sizeInMB = blob.size / (1024 * 1024); // byte → MB
  const timeInSec = timeInMs / 1000;
  const speed = (sizeInMB / timeInSec).toFixed(3);
  console.log(`[PERFORMANCE] Ukuran file: ${sizeInMB.toFixed(2)} MB`);
  console.log(`[PERFORMANCE] Kecepatan transfer file: ${speed} MB/s`);
};
