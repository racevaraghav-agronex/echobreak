const TrafficLog = require("../models/TrafficLog");
const { trafficStateFromRisk } = require("../utils/riskEngine");
const { analyzeVehicleFlow } = require("./trafficFlowService");
const { getActiveVehicles } = require("./vehicleStateService");

/**
 * Predicts congestion risk for a road segment/area using recent event density
 * as a proxy for vehicle load. This is a real, deterministic heuristic model —
 * it is explicitly a prediction/estimate, not confirmed live traffic-count data.
 */
async function predictCongestion({ lat, lng, radiusMeters = 500 }) {
  const recentEvents = await TrafficLog.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    },
    createdAt: { $gte: new Date(Date.now() - 20 * 60 * 1000) },
  }).limit(50);

  const eventDensity = recentEvents.length;
  const avgRisk =
    recentEvents.reduce((sum, e) => sum + (e.riskScore || 0), 0) / (recentEvents.length || 1);

  const activeVehicles = getActiveVehicles().filter((vehicle) => {
    const deltaLat = Math.abs(vehicle.lat - lat);
    const deltaLng = Math.abs(vehicle.lng - lng);
    return deltaLat < 0.06 && deltaLng < 0.06;
  });
  const flow = analyzeVehicleFlow(activeVehicles, { radiusMeters });
  const congestionFactor = Math.min(100, Math.round(flow.congestionFactor * 0.7 + eventDensity * 5 + avgRisk * 0.15));
  const trafficState = trafficStateFromRisk(avgRisk, congestionFactor);

  return {
    trafficState,
    congestionFactor,
    eventDensity,
    avgRisk: Math.round(avgRisk),
    source: "predicted",
    ...flow,
    confidence: Math.min(0.95, Math.max(flow.confidence, 0.4 + eventDensity * 0.05)),
  };
}

module.exports = { predictCongestion };
