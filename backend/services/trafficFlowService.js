function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function analyzeVehicleFlow(vehicles = [], { radiusMeters = 5000, speedLimitKph = 80 } = {}) {
  const speedsKph = vehicles.map((vehicle) => Math.max(0, Number(vehicle.speed) || 0) * 3.6);
  const averageSpeedKph = average(speedsKph);
  const variance = average(speedsKph.map((speed) => (speed - averageSpeedKph) ** 2));
  const suddenSlowdowns = vehicles.filter((vehicle) => Number(vehicle.acceleration) < -3).length;
  const densityScore = Math.min(45, vehicles.length * 4);
  const slowdownScore = Math.min(30, suddenSlowdowns * 10);
  const varianceScore = Math.min(25, Math.sqrt(variance) * 0.8);
  const congestionFactor = Math.round(Math.min(100, densityScore + slowdownScore + varianceScore));
  const risk = congestionFactor >= 70 ? "HIGH" : congestionFactor >= 40 ? "MEDIUM" : "LOW";
  const safeLimit = Math.max(20, Number(speedLimitKph) || 80);
  const recommendedSpeedKph = Math.round(Math.min(safeLimit, Math.max(20, (averageSpeedKph || safeLimit) - congestionFactor * 0.18)));
  return {
    vehicleCount: vehicles.length,
    radiusMeters,
    averageSpeedKph: Math.round(averageSpeedKph),
    speedVariance: Math.round(variance),
    suddenSlowdowns,
    congestionFactor,
    trafficRisk: risk,
    recommendedSpeedKph,
    confidence: Math.min(0.95, Math.max(0.25, 0.35 + vehicles.length * 0.05 + (suddenSlowdowns ? 0.15 : 0))),
    reason: congestionFactor >= 70 ? "Congestion predicted ahead from vehicle density and slowing signals." : congestionFactor >= 40 ? "Traffic flow is becoming uneven ahead." : "No strong congestion signal detected from available vehicles.",
  };
}

module.exports = { analyzeVehicleFlow };