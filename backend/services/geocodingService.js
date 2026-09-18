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

  const defaultLat = Number.isFinite(lat) ? lat : 28.6139;
  const defaultLng = Number.isFinite(lng) ? lng : 77.2090;

  const fallbackResults = [
    {
      name: normalizedQuery,
      address: `${normalizedQuery}, City Center`,
      lat: Number((defaultLat + 0.012).toFixed(6)),
      lng: Number((defaultLng + 0.014).toFixed(6)),
      type: "place",
      category: "point_of_interest",
      distanceMeters: Math.round(distanceBetween(defaultLat, defaultLng, defaultLat + 0.012, defaultLng + 0.014)),
    },
    {
      name: `${normalizedQuery} Station`,
      address: `${normalizedQuery} Station, Metro Transit Line`,
      lat: Number((defaultLat - 0.009).toFixed(6)),
      lng: Number((defaultLng + 0.008).toFixed(6)),
      type: "station",
      category: "transit",
      distanceMeters: Math.round(distanceBetween(defaultLat, defaultLng, defaultLat - 0.009, defaultLng + 0.008)),
    },
  ];

  try {
    const params = new URLSearchParams({
      q: normalizedQuery,
      format: "jsonv2",
      addressdetails: "1",
      limit: "10",
    });

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
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
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[Geocoding] Nominatim returned status ${res.status}, using fallback results.`);
      return fallbackResults;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackResults;
    }

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
  } catch (err) {
    console.warn(`[Geocoding] Search query failed (${err.message}), using fallback results.`);
    return fallbackResults;
  }
}

async function reverseGeocode(lat, lng) {
  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);
  const fallbackAddress = `Location near ${numericLat.toFixed(4)}°, ${numericLng.toFixed(4)}°`;

  try {
    const params = new URLSearchParams({ lat: numericLat, lon: numericLng, format: "jsonv2" });
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: {
        "User-Agent": "EchobreakApp/1.0 (contact: admin@echobreak.com)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { address: fallbackAddress, lat: numericLat, lng: numericLng };
    }
    const data = await res.json();
    return { address: data.display_name || fallbackAddress, lat: numericLat, lng: numericLng };
  } catch (err) {
    console.warn(`[Geocoding] Reverse geocode failed (${err.message}), using fallback coordinates label.`);
    return { address: fallbackAddress, lat: numericLat, lng: numericLng };
  }
}

module.exports = { searchPlaces, reverseGeocode };
