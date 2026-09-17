const express = require("express");
const User = require("../models/User");
const TrafficLog = require("../models/TrafficLog");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

// GET /api/admin/users
router.get("/users", async (req, res) => {
  const users = await User.find({}).sort({ updatedAt: -1 }).limit(200);
  res.json({
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      vehicleMode: u.vehicleMode,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
      location: { lat: u.currentLocation.coordinates[1], lng: u.currentLocation.coordinates[0] },
    })),
  });
});

// GET /api/admin/metrics
router.get("/metrics", async (req, res) => {
  const totalUsers = await User.countDocuments({});
  const onlineUsers = await User.countDocuments({ isOnline: true });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [acousticEvents, riskZones, hazards, reports] = await Promise.all([
    TrafficLog.countDocuments({ eventType: { $ne: "user_report" }, createdAt: { $gte: since } }),
    TrafficLog.countDocuments({ riskScore: { $gte: 30 }, createdAt: { $gte: since } }),
    TrafficLog.countDocuments({ riskScore: { $gte: 55 }, createdAt: { $gte: since } }),
    TrafficLog.countDocuments({ eventType: "user_report", createdAt: { $gte: since } }),
  ]);

  res.json({
    totalUsers,
    onlineUsers,
    acousticSensorHealth: 100,
    acousticEvents,
    riskZones,
    potentialHazards: hazards,
    trafficEvents: acousticEvents + reports,
    userReports: reports,
    preventiveInterventions: hazards,
  });
});

module.exports = router;
