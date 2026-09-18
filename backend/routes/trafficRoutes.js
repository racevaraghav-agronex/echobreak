const express = require("express");
const User = require("../models/User");
const TrafficLog = require("../models/TrafficLog");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getRoutes } = require("../services/routingService");
const {
  searchPlaces,
  reverseGeocode,
} = require("../services/geocodingService");
const { getNearbyFeatures } = require("../services/osmService");
const { processAcousticEvent } = require("../services/acousticService");
const { predictCongestion } = require("../services/trafficPredictionService");
const { getPacingAdvice } = require("../services/speedPacingService");
const { startOrUpdateRecovery } = require("../services/navigationService");
const { describeRisk } = require("../utils/riskEngine");
const { emitEvent, emitNearbyEvent, getNearbyVehicleSnapshot } = require("../utils/socket");
const { isValidCoordinate } = require("../utils/geo");

const router = express.Router();

// ---------- Geocoding / places ----------

// GET /api/traffic/search?q=...&lat=..&lng=..
router.get("/search", protect, async (req, res) => {
  try {
    const { q, lat, lng } = req.query;
    const results = await searchPlaces(q, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
    res.json({ results: results || [] });
  } catch (err) {
    console.error("Search error:", err.message);
    res.json({
      message: "Search provider unavailable. Please try again.",
      results: [],
    });
  }
});

router.get("/reverse-geocode", protect, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const result = await reverseGeocode(lat, lng);
    res.json(result);
  } catch (err) {
    const latNum = parseFloat(req.query.lat) || 0;
    const lngNum = parseFloat(req.query.lng) || 0;
    res.json({
      address: `Location (${latNum.toFixed(4)}°, ${lngNum.toFixed(4)}°)`,
      lat: latNum,
      lng: lngNum,
    });
  }
});

// GET /api/traffic/osm-features?lat=..&lng=..&radius=..&category=petrol
router.get("/osm-features", protect, async (req, res) => {
  try {
    const { lat, lng, radius, category } = req.query;
    let features = [];
    try {
      features = await getNearbyFeatures({ lat, lng, radius: radius || 5000, category });
    } catch (providerError) {
      console.warn("OSM feature provider unavailable, using geocoding fallback:", providerError.message);
    }
    if (!features.length && category) {
      const categoryQueries = {
        petrol: "petrol fuel station",
        hospital: "hospital clinic",
        restaurants: "restaurant cafe",
        hotels: "hotel",
        parking: "parking",
      };
      features = await searchPlaces(categoryQueries[category] || category, {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
    }
    res.json({ features: features || [] });
  } catch (err) {
    console.error("OSM feature error:", err.message);
    res.json({ message: "OpenStreetMap features unavailable.", features: [] });
  }
});

// ---------- Routing ----------

// POST /api/traffic/route  { originLat, originLng, destLat, destLng, vehicleMode }
router.post("/route", protect, async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng, vehicleMode } = req.body;
    if ([originLat, originLng, destLat, destLng].some((v) => v === undefined)) {
      return res
        .status(400)
        .json({ message: "origin and destination coordinates are required." });
    }
    const routes = await getRoutes({
      originLat: parseFloat(originLat),
      originLng: parseFloat(originLng),
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
      vehicleMode,
    });

    // Attach Echobreak route risk per route using nearby predicted congestion at midpoint
    const enriched = await Promise.all(
      routes.map(async (route) => {
        const coords = route.geometry?.coordinates || [];
        const mid = coords[Math.floor(coords.length / 2)] || [
          originLng,
          originLat,
        ];
        let prediction;
        try {
          prediction = await predictCongestion({
            lat: mid[1],
            lng: mid[0],
          });
        } catch {
          prediction = { avgRisk: 25, congestionFactor: 1.0 };
        }
        const risk = describeRisk(prediction.avgRisk || 25);
        return {
          ...route,
          echobreakRisk: {
            ...risk,
            congestionFactor: prediction.congestionFactor || 1.0,
          },
        };
      }),
    );

    res.json({ routes: enriched });
  } catch (err) {
    console.error("Routing error:", err.message);
    res
      .status(500)
      .json({ message: "Could not calculate route. Please try again." });
  }
});

// ---------- Acoustic / risk ----------

// POST /api/traffic/acoustic-event
router.post("/acoustic-event", protect, async (req, res) => {
  try {
    const { eventType, confidence, severity, lat, lng, vehicleType, source } =
      req.body;
    if (!eventType || !isValidCoordinate(Number(lat), Number(lng)) || !Number.isFinite(Number(confidence)) || Number(confidence) < 0 || Number(confidence) > 1) {
      return res
        .status(400)
        .json({ message: "eventType, valid coordinates, and confidence between 0 and 1 are required." });
    }
    const result = await processAcousticEvent({
      eventType,
      confidence,
      severity,
      lat,
      lng,
      vehicleType,
      source,
    });
    const acousticPayload = {
      id: result.log._id,
      eventType,
      lat,
      lng,
      riskScore: result.riskScore,
      clusterCount: result.clusterCount,
      message: "Potential acoustic safety signal detected nearby. Please remain attentive.",
    };
    emitNearbyEvent("acoustic:event", acousticPayload, { lat: Number(lat), lng: Number(lng) });
    emitNearbyEvent("risk:update", {
      lat,
      lng,
      riskScore: result.riskScore,
      ...describeRisk(result.riskScore),
    }, { lat: Number(lat), lng: Number(lng) });
    res.status(201).json({
      ...describeRisk(result.riskScore),
      riskScore: result.riskScore,
      logId: result.log._id,
    });
  } catch (err) {
    console.error("Acoustic event error:", err.message);
    res.status(500).json({ message: "Could not process acoustic event." });
  }
});

// GET /api/traffic/risk-zones?lat=..&lng=..&radius=..
router.get("/risk-zones", protect, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 3000;

    const zones = await TrafficLog.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radius,
        },
      },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    }).limit(100);

    res.json({
      zones: zones.map((z) => ({
        id: z._id,
        eventType: z.eventType,
        lat: z.location.coordinates[1],
        lng: z.location.coordinates[0],
        riskScore: z.riskScore,
        source: z.source,
        confidence: z.confidence,
        createdAt: z.createdAt,
      })),
    });
  } catch (err) {
    console.error("Risk zones error:", err.message);
    res.status(500).json({ message: "Could not load risk zones.", zones: [] });
  }
});

// POST /api/traffic/report
router.post("/report", protect, async (req, res) => {
  try {
    const { reportType, lat, lng, notes } = req.body;
    if (!reportType || lat === undefined || lng === undefined) {
      return res
        .status(400)
        .json({ message: "reportType, lat and lng are required." });
    }
    const log = await TrafficLog.create({
      eventType: "user_report",
      severity: "medium",
      confidence: 0.8,
      location: { type: "Point", coordinates: [lng, lat] },
      riskScore: 40,
      source: "confirmed",
      metadata: { reportType, notes },
      reportedBy: req.user._id,
    });
    emitEvent("traffic:update", { id: log._id, reportType, lat, lng });
    res
      .status(201)
      .json({ message: "Report submitted. Thank you.", logId: log._id });
  } catch (err) {
    console.error("Report error:", err.message);
    res.status(500).json({ message: "Could not submit report." });
  }
});

// POST /api/traffic/predict  { lat, lng }
router.post("/predict", protect, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const prediction = await predictCongestion({ lat, lng });
    emitEvent("risk:update", { lat, lng, ...prediction });
    res.json(prediction);
  } catch (err) {
    console.error("Predict error:", err.message);
    res.status(500).json({ message: "Prediction failed." });
  }
});

// POST /api/traffic/pacing  { lat, lng, currentSpeed }
router.post("/pacing", protect, async (req, res) => {
  try {
    const { lat, lng, currentSpeed } = req.body;
    const prediction = await predictCongestion({ lat, lng });
    const recovery = startOrUpdateRecovery({
      lat,
      lng,
      congestionFactor: prediction.congestionFactor,
    });
    const advice = getPacingAdvice({
      congestionFactor: prediction.congestionFactor,
      currentSpeed,
      recoveryMode: recovery.recoveryMode,
      recommendedSpeedKph: prediction.recommendedSpeedKph,
      confidence: prediction.confidence,
      trafficRisk: prediction.trafficRisk,
      reason: prediction.reason,
    });
    emitEvent("pacing:update", { lat, lng, ...advice });
    res.json({
      ...advice,
      prediction,
      recoveryMode: recovery.recoveryMode,
      stage: recovery.stage,
    });
  } catch (err) {
    console.error("Pacing error:", err.message);
    res.status(500).json({ message: "Pacing advisory failed." });
  }
});

// POST /api/traffic/recovery  { lat, lng }
router.post("/recovery", protect, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const prediction = await predictCongestion({ lat, lng });
    const recovery = startOrUpdateRecovery({
      lat,
      lng,
      congestionFactor: prediction.congestionFactor,
    });
    emitEvent(recovery.recoveryMode ? "recovery:update" : "recovery:end", {
      lat,
      lng,
      ...recovery,
    });
    res.json(recovery);
  } catch (err) {
    console.error("Recovery error:", err.message);
    res.status(500).json({ message: "Recovery check failed." });
  }
});

// GET /api/traffic/nearby?lat=..&lng=..  -> connected users + untracked traffic near a point
router.get("/nearby", protect, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    const users = await User.find({
      isOnline: true,
      currentLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 5000,
        },
      },
    }).limit(50);

    const untracked = await TrafficLog.find({
      eventType: { $in: ["proximity_echo_anomaly", "heavy_vehicle_vibration"] },
      source: "estimated",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 2000,
        },
      },
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    }).limit(30);

    const persistedUsers = users.map((u) => ({
        id: u._id,
        vehicleMode: u.vehicleMode,
        lat: u.currentLocation.coordinates[1],
        lng: u.currentLocation.coordinates[0],
      }));
    const liveVehicles = getNearbyVehicleSnapshot({ lat, lng }, 5000).map((vehicle) => ({
      id: vehicle.vehicleSessionId,
      vehicleMode: "unknown",
      lat: vehicle.lat,
      lng: vehicle.lng,
      speed: vehicle.speed,
      heading: vehicle.heading,
      anonymous: true,
    }));
    res.json({
      connectedUsers: [...persistedUsers, ...liveVehicles.filter((vehicle) => !persistedUsers.some((user) => String(user.id) === String(vehicle.id)))],
      untrackedTraffic: untracked.map((t) => ({
        id: t._id,
        lat: t.location.coordinates[1],
        lng: t.location.coordinates[0],
        confidence: t.confidence,
      })),
    });
  } catch (err) {
    console.error("Nearby error:", err.message);
    res.status(500).json({
      message: "Could not load nearby data.",
      connectedUsers: [],
      untrackedTraffic: [],
    });
  }
});

// ---------- Convenience endpoints consumed directly by AdminDashboard.jsx ----------

// GET /api/traffic/users
router.get("/users", protect, adminOnly, async (req, res) => {
  const users = await User.find({}).sort({ updatedAt: -1 }).limit(200);
  res.json({
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      vehicleMode: u.vehicleMode,
      isOnline: u.isOnline,
      location: {
        lat: u.currentLocation.coordinates[1],
        lng: u.currentLocation.coordinates[0],
      },
    })),
  });
});

// GET /api/traffic/stats
router.get("/stats", protect, adminOnly, async (req, res) => {
  const totalUsers = await User.countDocuments({});
  const onlineUsers = await User.countDocuments({ isOnline: true });
  const riskEvents = await TrafficLog.countDocuments({
    riskScore: { $gte: 55 },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  res.json({
    totalUsers,
    onlineUsers,
    accidentZonesPrevented: riskEvents,
    sensorNetworkHealth: 100,
  });
});

module.exports = router;
