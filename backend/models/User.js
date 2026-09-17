const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    vehicleMode: {
      type: String,
      enum: ["car", "bike", "transit", "walking", "truck", "bus", "tempo", "hcv"],
      default: "car",
    },
    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserSchema.index({ currentLocation: "2dsphere" });

const MongooseUser = mongoose.model("User", UserSchema);
const { MemoryUser } = require("./memoryStore");

const UserProxy = new Proxy(MongooseUser, {
  get(target, prop) {
    if (mongoose.connection.readyState === 1) {
      return target[prop];
    }
    // Only permit in-memory fallback in non-production development environments
    if (process.env.NODE_ENV !== "production" && prop in MemoryUser) {
      return MemoryUser[prop];
    }
    return target[prop];
  },
});

module.exports = UserProxy;

