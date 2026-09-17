const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(first, second) {
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const latitude = toRadians(first.lat);
  const targetLatitude = toRadians(second.lat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(latitude) * Math.cos(targetLatitude) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

module.exports = { distanceMeters, isValidCoordinate };