const { distanceMeters } = require("../utils/geo");

function relativeClosingSpeedMetersPerSecond(ego, other) {
  const egoSpeed = Math.max(0, Number(ego.speed) || 0);
  const otherSpeed = Math.max(0, Number(other.speed) || 0);
  return Math.max(0, egoSpeed - otherSpeed);
}

function calculateCollisionRisk(ego, nearbyVehicle) {
  const distance = distanceMeters(ego, nearbyVehicle);
  const closingSpeed = relativeClosingSpeedMetersPerSecond(ego, nearbyVehicle);
  const timeToCollision = closingSpeed > 0 ? distance / closingSpeed : Infinity;
  const brakingSignal = Number(nearbyVehicle.acceleration) < -3 || Number(ego.acceleration) < -3;
  let score = 0;
  if (timeToCollision < 2) score += 75;
  else if (timeToCollision < 4) score += 50;
  else if (timeToCollision < 7) score += 25;
  if (distance < 15) score += 20;
  else if (distance < 30) score += 10;
  if (brakingSignal) score += 15;
  score = Math.min(100, Math.round(score));
  const severity = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
  return {
    type: "COLLISION_RISK",
    severity,
    confidence: Math.min(0.98, Math.max(0.2, 0.45 + (Number.isFinite(timeToCollision) ? 0.35 : 0) + (brakingSignal ? 0.15 : 0))),
    score,
    distanceMeters: Math.round(distance),
    timeToCollisionSeconds: Number.isFinite(timeToCollision) ? Number(timeToCollision.toFixed(1)) : null,
    message: severity === "HIGH" ? "Collision Risk Detected. Please reduce speed and maintain a safe following distance." : "Potential Collision. Please remain attentive and maintain a safe distance.",
    expiresAt: new Date(Date.now() + (severity === "HIGH" ? 12000 : 8000)).toISOString(),
  };
}

function assessNearbyVehicles(ego, vehicles) {
  return vehicles.map((vehicle) => calculateCollisionRisk(ego, vehicle)).filter((event) => event.score >= 25).sort((first, second) => second.score - first.score);
}

module.exports = { calculateCollisionRisk, assessNearbyVehicles };