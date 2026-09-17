/**
 * Routing service — uses the public OSRM demo server by default.
 * Set ROUTING_API_KEY + swap OSRM_BASE_URL to point at a paid provider
 * (e.g. Mapbox Directions, OpenRouteService) for production traffic-aware routing.
 */
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const VEHICLE_PROFILE_MAP = {
  car: "driving",
  bike: "cycling",
  transit: "driving",
  walking: "foot",
  truck: "driving",
  bus: "driving",
  tempo: "driving",
  hcv: "driving",
};

async function getRoutes({ originLat, originLng, destLat, destLng, vehicleMode = "car" }) {
  const profile = VEHICLE_PROFILE_MAP[vehicleMode] || "driving";
  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${originLng},${originLat};${destLng},${destLat}?alternatives=true&overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Routing provider error: ${res.status}`);
  }
  const data = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No route found between origin and destination.");
  }

  return data.routes.map((route, idx) => ({
    routeId: `route_${idx}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry, // GeoJSON LineString
    legs: route.legs?.map((leg) => ({
      steps: leg.steps?.map((step) => ({
        instruction: step.maneuver?.type,
        modifier: step.maneuver?.modifier,
        roadName: step.name,
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        location: step.maneuver?.location, // [lng, lat]
      })),
    })),
  }));
}

module.exports = { getRoutes };
