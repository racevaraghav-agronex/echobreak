import api from "../utils/api";

export async function fetchRoutes({
  originLat,
  originLng,
  destLat,
  destLng,
  vehicleMode,
}) {
  const { data } = await api.post("/traffic/route", {
    originLat,
    originLng,
    destLat,
    destLng,
    vehicleMode,
  });
  return data.routes;
}

export async function searchDestinations(query, origin) {
  const { data } = await api.get("/traffic/search", {
    params: { q: query, lat: origin?.lat, lng: origin?.lng },
  });
  return data.results;
}

export async function fetchOsmFeatures(origin, radius = 3000, category) {
  const { data } = await api.get("/traffic/osm-features", {
    params: { lat: origin?.lat, lng: origin?.lng, radius, category },
  });
  return data.features;
}

export async function fetchNearbyCategory(category, origin) {
  return fetchOsmFeatures(origin, 5000, category);
}
