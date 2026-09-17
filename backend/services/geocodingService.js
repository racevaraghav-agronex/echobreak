/**
 * Geocoding service — uses OpenStreetMap's Nominatim by default (no key required,
 * respects usage policy with a descriptive User-Agent). Swap in a commercial
 * provider via GEOCODING_API_KEY for higher volume production use.
 */
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const SEARCH_RADIUS_KM = Number(process.env.GEOCODING_SEARCH_RADIUS_KM) || 50;

function distanceBetween(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchPlaces(query, { lat, lng } = {}) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const params = new URLSearchParams({
    q: normalizedQuery,
    format: "jsonv2",
    addressdetails: "1",
    limit: "10",
  });

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    // Prefer nearby results, but do not make the current GPS position a hard
    // restriction because users may search for a destination in another city.
    const radiusDegrees = SEARCH_RADIUS_KM / 111;
    params.set(
      "viewbox",
      `${lng - radiusDegrees},${lat + radiusDegrees},${lng + radiusDegrees},${lat - radiusDegrees}`,
    );
  }

  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: {
      "User-Agent": "EchobreakApp/1.0 (contact: admin@echobreak.com)",
    },
  });

  if (!res.ok) throw new Error(`Geocoding provider error: ${res.status}`);

  const data = await res.json();
  return data
    .map((place) => {
      const placeLat = parseFloat(place.lat);
      const placeLng = parseFloat(place.lon);
      return {
        name: place.display_name.split(",")[0],
        address: place.display_name,
        lat: placeLat,
        lng: placeLng,
        type: place.type,
        category: place.category,
        distanceMeters:
          Number.isFinite(lat) && Number.isFinite(lng)
            ? distanceBetween(lat, lng, placeLat, placeLng)
            : null,
      };
    })
    .sort(
      (first, second) =>
        (first.distanceMeters ?? Infinity) -
        (second.distanceMeters ?? Infinity),
    );
}

async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, format: "jsonv2" });
  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
    headers: {
      "User-Agent": "EchobreakApp/1.0 (contact: admin@echobreak.com)",
    },
  });
  if (!res.ok) throw new Error(`Reverse geocoding error: ${res.status}`);
  const data = await res.json();
  return { address: data.display_name, lat, lng };
}

module.exports = { searchPlaces, reverseGeocode };
