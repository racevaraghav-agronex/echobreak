const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { distanceMeters } = require("./geo");
const {
  updateVehicle,
  removeVehicle,
  touchVehicle,
  getActiveVehicles,
  nearbyVehicles,
} = require("../services/vehicleStateService");
const { assessNearbyVehicles } = require("../services/collisionRiskService");
const { publishEvent } = require("../services/eventEngine");

let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.id;
    } catch {
      return next(new Error("Invalid socket credentials."));
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    if (socket.data.userId) {
      User.findByIdAndUpdate(socket.data.userId, { isOnline: true, lastSeen: new Date() }).catch(() => {});
    }

    socket.on("user:location", (payload) => {
      const result = updateVehicle(socket.id, payload);
      if (!result.ok) {
        if (!result.throttled) socket.emit("vehicle:error", { message: result.message });
        return;
      }

      const vehicle = result.vehicle;
      socket.data.location = vehicle;
      if (socket.data.userId) {
        User.findByIdAndUpdate(socket.data.userId, {
          currentLocation: { type: "Point", coordinates: [vehicle.lng, vehicle.lat] },
          isOnline: true,
          lastSeen: new Date(),
        }).catch(() => {});
      }

      for (const peer of io.sockets.sockets.values()) {
        if (peer.id === socket.id || !peer.data.location) continue;
        if (distanceMeters(peer.data.location, vehicle) > 5000) continue;
        peer.emit("vehicle:update", vehicle);
        const risks = assessNearbyVehicles(peer.data.location, [vehicle]);
        for (const risk of risks) {
          publishEvent({ ...risk, location: { lat: vehicle.lat, lng: vehicle.lng }, affectedVehicleSessionId: vehicle.vehicleSessionId }, (event) => peer.emit("safety:event", event));
        }
      }
    });

    socket.on("vehicle:heartbeat", () => {
      touchVehicle(socket.id);
      if (socket.data.location) socket.data.location.timestamp = Date.now();
      if (socket.data.userId) User.findByIdAndUpdate(socket.data.userId, { isOnline: true, lastSeen: new Date() }).catch(() => {});
    });

    socket.on("audio:detection", (payload = {}) => {
      const confidence = Number(payload.confidence);
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(confidence) || confidence < 0.72 || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const detection = {
        type: "NEARBY_VEHICLE_AUDIO",
        severity: "MEDIUM",
        confidence: Math.min(1, confidence),
        location: { lat, lng },
        message: "Safety Alert. A possible nearby vehicle was detected acoustically. Please remain attentive and maintain a safe distance.",
        affectedVehicleSessionId: socket.data.location?.vehicleSessionId || null,
      };
      for (const peer of io.sockets.sockets.values()) {
        if (peer.id === socket.id || !peer.data.location || distanceMeters(peer.data.location, detection.location) > 2000) continue;
        publishEvent(detection, (event) => peer.emit("safety:event", event));
      }
    });

    socket.on("user:status", (payload) => {
      if (payload?.status === "offline") socket.data.location = null;
    });

    socket.on("navigation:update", (payload) => {
      socket.broadcast.emit("navigation:update", payload);
    });

    socket.on("disconnect", () => {
      removeVehicle(socket.id);
      if (socket.data.userId) User.findByIdAndUpdate(socket.data.userId, { isOnline: false, lastSeen: new Date() }).catch(() => {});
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
}

function getIO() {
  if (!ioInstance) throw new Error("Socket.IO not initialized yet");
  return ioInstance;
}

/** Emit helper so route handlers can push live events without importing socket.io directly */
function emitEvent(eventName, payload) {
  if (!ioInstance) return;
  ioInstance.emit(eventName, payload);
}

function emitNearbyEvent(eventName, payload, origin, radiusMeters = 3000) {
  if (!ioInstance || !origin) return;
  for (const socket of ioInstance.sockets.sockets.values()) {
    if (!socket.data.location || distanceMeters(socket.data.location, origin) <= radiusMeters) socket.emit(eventName, payload);
  }
}

function getNearbyVehicleSnapshot(origin, radiusMeters = 5000) {
  return nearbyVehicles(origin, radiusMeters);
}

module.exports = { initSocket, getIO, emitEvent, emitNearbyEvent, getNearbyVehicleSnapshot, getActiveVehicles };
