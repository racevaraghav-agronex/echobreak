export const SAFETY_CONFIG = {
  audioConfidenceThreshold: Number(import.meta.env.VITE_AUDIO_CONFIDENCE_THRESHOLD || 0.72),
  audioDetectionCooldownMs: Number(import.meta.env.VITE_AUDIO_DETECTION_COOLDOWN_MS || 15000),
  audioAnalysisIntervalMs: Number(import.meta.env.VITE_AUDIO_ANALYSIS_INTERVAL_MS || 500),
};