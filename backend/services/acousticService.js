const TrafficLog = require("../models/TrafficLog");
const { computeRiskScore } = require("../utils/riskEngine");

/**
 * Processes an incoming acoustic event (from a phone mic pipeline or roadside
 * sensor), scores it, and finds nearby recent events to determine clustering
 * (repeated signals in the same area raise confidence this is a real hazard,
 * not noise).
 */
async function processAcousticEvent({ eventType, confidence, severity, lat, lng, vehicleType, source }) {
  const nearby = await TrafficLog.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 300, // meters
      },
    },
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // last 10 minutes
  }).limit(20);

  const clusterCount = nearby.length + 1;
  const riskScore = computeRiskScore({ eventType, confidence, severity, clusterCount });

  const log = await TrafficLog.create({
    eventType,
    confidence,
    severity,
    location: { type: "Point", coordinates: [lng, lat] },
    riskScore,
    vehicleMode: vehicleType || "car",
    source: source || "estimated",
    metadata: { clusterCount },
  });

  return { log, clusterCount, riskScore };
}

module.exports = { processAcousticEvent };
