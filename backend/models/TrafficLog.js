const mongoose = require("mongoose");

const TrafficLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        "tyre_screech",
        "sudden_braking",
        "abnormal_engine",
        "collision_like",
        "proximity_echo_anomaly",
        "heavy_vehicle_vibration",
        "road_blockage_acoustic",
        "user_report",
        "congestion_prediction",
      ],
      required: true,
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    trafficState: {
      type: String,
      enum: ["NORMAL", "MODERATE", "SLOW", "HEAVY", "BLOCKED"],
      default: "NORMAL",
    },
    vehicleMode: { type: String, default: "car" },
    source: {
      type: String,
      enum: ["confirmed", "estimated", "predicted", "fallback"],
      default: "estimated",
    },
    routeId: { type: String, default: null },
    speed: { type: Number, default: null },
    pacingInstruction: { type: String, default: null },
    recoveryMode: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

TrafficLogSchema.index({ location: "2dsphere" });
TrafficLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("TrafficLog", TrafficLogSchema);
