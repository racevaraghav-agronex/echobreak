import { SAFETY_CONFIG } from "../config/safetyConfig";

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function classifySpectrum(analyser, buffer) {
  analyser.getByteFrequencyData(buffer);
  let total = 0;
  let vehicleBand = 0;
  const lowBandEnd = Math.floor(buffer.length * 0.45);
  const highBandStart = Math.floor(buffer.length * 0.08);
  for (let index = 0; index < buffer.length; index += 1) {
    total += buffer[index];
    if (index >= highBandStart && index <= lowBandEnd) vehicleBand += buffer[index];
  }
  const average = total / (buffer.length * 255 || 1);
  const bandRatio = vehicleBand / (total || 1);
  const confidence = clamp((average - 0.08) * 2.2 + bandRatio * 0.55);
  return { detected: confidence >= SAFETY_CONFIG.audioConfidenceThreshold, confidence };
}

export async function startVehicleAudioMonitor(onDetection, onError) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!window.isSecureContext) {
    onError?.(new Error("Microphone requires HTTPS or localhost."));
    return null;
  }
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextConstructor) {
    onError?.(new Error("This browser does not support microphone audio analysis."));
    return null;
  }
  let stream;
  let context;
  try {
    const permissionRequest = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    stream = await Promise.race([
      permissionRequest,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Microphone permission request timed out.")), 10000)),
    ]);
    context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let lastDetectionAt = 0;
    let consecutiveDetections = 0;
    const interval = window.setInterval(() => {
      const result = classifySpectrum(analyser, buffer);
      consecutiveDetections = result.detected ? consecutiveDetections + 1 : 0;
      if (consecutiveDetections < 3 || Date.now() - lastDetectionAt < SAFETY_CONFIG.audioDetectionCooldownMs) return;
      lastDetectionAt = Date.now();
      onDetection({
        type: "NEARBY_VEHICLE_AUDIO",
        detected: true,
        confidence: result.confidence,
        direction: null,
        distanceMeters: null,
        message: "Safety alert: A possible nearby vehicle was detected. Reduce speed smoothly and maintain a safe following distance.",
        timestamp: new Date().toISOString(),
      });
    }, SAFETY_CONFIG.audioAnalysisIntervalMs);
    return () => {
      window.clearInterval(interval);
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      analyser.disconnect();
      context.close();
    };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    await context?.close?.();
    const message = error.name === "NotAllowedError" ? "Microphone permission denied. Allow microphone access in the browser address bar." : error.message || "Microphone detection is unavailable.";
    onError?.(new Error(message));
    return null;
  }
}