/**
 * OpenStreetMap feature access through Overpass.
 * Keep this behind the backend so the provider can be replaced or self-hosted
 * without exposing provider URLs in the browser.
 */
const OVERPASS_URLS = [
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
].filter((url, index, urls) => url && urls.indexOf(url) === index);
const MAX_RADIUS_METERS = 5000;
const REQUEST_TIMEOUT_MS = 30000;

const CATEGORY_FILTERS = {
  petrol: '["amenity"="fuel"]',
  hospital: '["amenity"="hospital"]',
  restaurants: '["amenity"~"restaurant|cafe|fast_food"]',
  hotels: '["tourism"~"hotel|hostel|guest_house"]',
  parking: '["amenity"="parking"]',
};

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

async function getNearbyFeatures({ lat, lng, radius = 3000, category } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const safeRadius = Math.min(
    Math.max(Number(radius) || 1200, 100),
    MAX_RADIUS_METERS,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("A valid latitude and longitude are required.");
  }

  const filter = CATEGORY_FILTERS[category] || "[name]";
  const query = `[out:json][timeout:20];nwr(around:${safeRadius},${latitude},${longitude})${filter};out center tags;`;
  let data;
  let lastError;

  for (const overpassUrl of OVERPASS_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(overpassUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "EchobreakApp/1.0 (contact: admin@echobreak.com)",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OSM feature provider error: ${response.status}`);
      }

      data = await response.json();
      break;
    } catch (error) {
      lastError = error.name === "AbortError"
        ? new Error(`OSM feature provider timed out: ${overpassUrl}`)
        : error;
      console.warn(lastError.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!data) {
    throw lastError || new Error("No OSM feature provider is available.");
  }

  return (data.elements || [])
    .map((element) => {
      const elementLat = element.lat ?? element.center?.lat;
      const elementLng = element.lon ?? element.center?.lon;
      if (!Number.isFinite(elementLat) || !Number.isFinite(elementLng))
        return null;

      return {
        id: `${element.type}/${element.id}`,
        osmType: element.type,
        osmId: element.id,
        lat: elementLat,
        lng: elementLng,
        name: element.tags?.name || element.tags?.brand || "Unnamed place",
        category:
          element.tags?.amenity ||
          element.tags?.shop ||
          element.tags?.tourism ||
          element.tags?.highway ||
          "feature",
        distanceMeters: distanceBetween(
          latitude,
          longitude,
          elementLat,
          elementLng,
        ),
        tags: element.tags || {},
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, 500);
}

module.exports = { getNearbyFeatures };
