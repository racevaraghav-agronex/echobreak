const crypto = require("crypto");
const { distanceMeters, isValidCoordinate } = require("../utils/geo");

const DEFAULT_TTL_MS = Number(process.env.VEHICLE_STATE_TTL_MS) || 45000;
const MAX_UPDATE_INTERVAL_MS = Number(process.env.VEHICLE_UPDATE_INTERVAL_MS) || 750;
const activeVehicles = new Map();

function finite(value, fallback = null) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function validateUpdate(payload = {}) {
  const lat = finite(payload.lat);
  const lng = finite(payload.lng);
  if (!isValidCoordinate(lat, lng)) return { ok: false, message: "Valid latitude and longitude are required." };

  const speed = Math.max(0, Math.min(finite(payload.speed, 0), 100));
  const heading = finite(payload.heading);
  const acceleration = finite(payload.acceleration);
  return {
    ok: true,
    value: {
      lat,
      lng,
      speed,
      heading: heading == null ? null : ((heading % 360) + 360) % 360,
      acceleration: acceleration == null ? null : Math.max(-20, Math.min(acceleration, 20)),
      routeId: typeof payload.routeId === "string" ? payload.routeId.slice(0, 120) : null,
      hasDestination: Boolean(payload.hasDestination),
      timestamp: Date.now(),
    },
  };
}

function updateVehicle(connectionId, payload) {
  const parsed = validateUpdate(payload);
  if (!parsed.ok) return parsed;
  const previous = activeVehicles.get(connectionId);
  if (previous && parsed.value.timestamp - previous.timestamp < MAX_UPDATE_INTERVAL_MS) {
    return { ok: false, throttled: true, message: "Vehicle update rate limited." };
  }
  const vehicle = {
    ...(previous || {}),
    ...parsed.value,
    sessionId: previous?.sessionId || crypto.randomUUID(),
    connectionId,
    lastSeen: parsed.value.timestamp,
  };
  activeVehicles.set(connectionId, vehicle);
  return { ok: true, vehicle: publicVehicle(vehicle) };
}

function publicVehicle(vehicle) {
  return {
    vehicleSessionId: vehicle.sessionId,
    lat: vehicle.lat,
    lng: vehicle.lng,
    speed: vehicle.speed,
    heading: vehicle.heading,
    acceleration: vehicle.acceleration,
    routeId: vehicle.routeId,
    hasDestination: vehicle.hasDestination,
    timestamp: vehicle.timestamp,
  };
}

function removeVehicle(connectionId) {
  const vehicle = activeVehicles.get(connectionId);
  activeVehicles.delete(connectionId);
  return vehicle ? publicVehicle(vehicle) : null;
}

function touchVehicle(connectionId) {
  const vehicle = activeVehicles.get(connectionId);
  if (!vehicle) return false;
  vehicle.lastSeen = Date.now();
  vehicle.timestamp = vehicle.lastSeen;
  return true;
}

function nearbyVehicles(origin, radiusMeters = 5000, excludeConnectionId) {
  const now = Date.now();
  const result = [];
  for (const [connectionId, vehicle] of activeVehicles) {
    if (now - vehicle.lastSeen > DEFAULT_TTL_MS) {
      activeVehicles.delete(connectionId);
      continue;
    }
    if (connectionId !== excludeConnectionId && distanceMeters(origin, vehicle) <= radiusMeters) result.push(publicVehicle(vehicle));
  }
  return result;
}

function cleanupStaleVehicles() {
  const cutoff = Date.now() - DEFAULT_TTL_MS;
  for (const [connectionId, vehicle] of activeVehicles) if (vehicle.lastSeen < cutoff) activeVehicles.delete(connectionId);
}

function getVehicleCount() {
  cleanupStaleVehicles();
  return activeVehicles.size;
}

function getActiveVehicles() {
  cleanupStaleVehicles();
  return [...activeVehicles.entries()].map(([connectionId, vehicle]) => ({ connectionId, ...publicVehicle(vehicle) }));
}

const cleanupTimer = setInterval(cleanupStaleVehicles, Math.max(DEFAULT_TTL_MS / 2, 5000));
cleanupTimer.unref?.();

module.exports = { updateVehicle, removeVehicle, touchVehicle, nearbyVehicles, cleanupStaleVehicles, getVehicleCount, getActiveVehicles, validateUpdate, publicVehicle };