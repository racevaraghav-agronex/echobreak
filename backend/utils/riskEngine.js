/**
 * Echobreak Risk Engine
 * Converts acoustic/traffic events into a probabilistic risk score (0-100)
 * and a qualitative risk level. All outputs are estimates, never guarantees.
 */

const EVENT_BASE_SEVERITY = {
  tyre_screech: 55,
  sudden_braking: 45,
  abnormal_engine: 30,
  collision_like: 85,
  proximity_echo_anomaly: 25,
  heavy_vehicle_vibration: 20,
  road_blockage_acoustic: 60,
  user_report: 50,
  congestion_prediction: 35,
};

function riskLevelFromScore(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function computeRiskScore({ eventType, confidence = 0.5, severity = "low", clusterCount = 1 }) {
  const base = EVENT_BASE_SEVERITY[eventType] ?? 20;
  const severityMultiplier = { low: 0.6, medium: 0.85, high: 1, critical: 1.15 }[severity] ?? 0.75;
  const clusterBoost = Math.min(1 + (clusterCount - 1) * 0.12, 1.6); // repeated nearby events raise confidence
  const raw = base * severityMultiplier * confidence * clusterBoost;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function trafficStateFromRisk(riskScore, congestionFactor = 0) {
  const combined = riskScore * 0.5 + congestionFactor * 0.5;
  if (combined >= 75) return "BLOCKED";
  if (combined >= 55) return "HEAVY";
  if (combined >= 35) return "SLOW";
  if (combined >= 15) return "MODERATE";
  return "NORMAL";
}

function describeRisk(score) {
  const level = riskLevelFromScore(score);
  const phrases = {
    LOW: "Low risk — conditions appear normal.",
    MEDIUM: "Moderate risk — elevated collision-risk signal detected.",
    HIGH: "High risk — potential hazard detected nearby.",
    CRITICAL: "Critical risk — strong hazard signal detected. Proceed with caution.",
  };
  return { level, message: phrases[level] };
}

module.exports = { computeRiskScore, riskLevelFromScore, trafficStateFromRisk, describeRisk };
