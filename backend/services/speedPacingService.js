/**
 * Speed pacing service — advisory only. Never controls a vehicle, never issues
 * unsafe instructions. Produces a smoothing suggestion aimed at reducing the
 * "accordion effect" (stop-start waves) in queued traffic.
 */

const PACING_MESSAGES = {
  maintain: "Maintain speed",
  reduce_slightly: "Reduce speed slightly",
  increase_gap: "Increase following gap",
  continue_normally: "Continue normally",
  prepare_slowdown: "Prepare for slowdown ahead",
};

function getPacingAdvice({ congestionFactor = 0, currentSpeed = 0, recoveryMode = false, recommendedSpeedKph = null, confidence = 0.5, trafficRisk = "LOW", reason = null }) {
  const advisorySpeed = recommendedSpeedKph == null ? null : Math.max(20, Math.round(Number(recommendedSpeedKph)));
  const flow = {
    recommendedSpeedKph: advisorySpeed,
    trafficRisk,
    confidence,
    reason: reason || "Recommendation is advisory and does not guarantee traffic-free travel.",
  };
  if (recoveryMode) {
    return { ...flow, instruction: PACING_MESSAGES.increase_gap, reason: "FIFO recovery in progress in this segment." };
  }
  if (congestionFactor >= 70) {
    return { ...flow, instruction: PACING_MESSAGES.prepare_slowdown, reason: "Heavy congestion predicted ahead." };
  }
  if (congestionFactor >= 40) {
    return { ...flow, instruction: PACING_MESSAGES.reduce_slightly, reason: "Moderate congestion building ahead." };
  }
  if (congestionFactor >= 15) {
    return { ...flow, instruction: PACING_MESSAGES.increase_gap, reason: "Light congestion — keep a safe following gap." };
  }
  return { ...flow, instruction: PACING_MESSAGES.continue_normally, reason: "Traffic flow is normal." };
}

module.exports = { getPacingAdvice };
