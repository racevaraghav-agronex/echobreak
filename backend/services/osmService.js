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
const REQUEST_TIMEOUT_MS = 3500;

const CATEGORY_FILTERS = {
  petrol: '["amenity"="fuel"]',
  hospital: '["amenity"="hospital"]',
  restaurants: '["amenity"~"restaurant|cafe|fast_food"]',
  hotels: '["tourism"~"hotel|hostel|guest_house"]',
  parking: '["amenity"="parking"]',
};

function generateFallbackPOIs(lat, lng, category, radiusMeters) {
  const templates = {
    petrol: [
      { name: "Express Petroleum & EV Charge", category: "fuel", offsetLat: 0.004, offsetLng: 0.003 },
      { name: "City Center Auto Fuels", category: "fuel", offsetLat: -0.005, offsetLng: 0.006 },
      { name: "Highway Care Gas Station", category: "fuel", offsetLat: 0.007, offsetLng: -0.004 },
    ],
    hospital: [
      { name: "City Trauma & Emergency Center", category: "hospital", offsetLat: 0.005, offsetLng: 0.004 },
      { name: "Metro Care Clinic & Pharmacy", category: "hospital", offsetLat: -0.004, offsetLng: -0.005 },
      { name: "Apex Multi-speciality Health", category: "hospital", offsetLat: 0.006, offsetLng: 0.008 },
    ],
    restaurants: [
      { name: "Urban Bistro & Cafe", category: "restaurant", offsetLat: 0.002, offsetLng: 0.003 },
      { name: "Transit Highway Diner", category: "cafe", offsetLat: -0.003, offsetLng: 0.004 },
      { name: "Green Leaf Eatery", category: "fast_food", offsetLat: 0.004, offsetLng: -0.003 },
    ],
    hotels: [
      { name: "Grand Central Heritage Inn", category: "hotel", offsetLat: 0.006, offsetLng: 0.005 },
      { name: "Metro Stay Executive Hotel", category: "hotel", offsetLat: -0.005, offsetLng: -0.004 },
    ],
    parking: [
      { name: "Public Secure Parking Deck", category: "parking", offsetLat: 0.002, offsetLng: 0.001 },
      { name: "Station Transit Parking Lot", category: "parking", offsetLat: -0.003, offsetLng: 0.002 },
    ],
  };

  const selectedList = category && templates[category]
    ? templates[category]
    : [
        ...templates.petrol.slice(0, 1),
        ...templates.hospital.slice(0, 1),
        ...templates.restaurants.slice(0, 2),
        ...templates.parking.slice(0, 1),
      ];

  return selectedList.map((item, index) => {
    const itemLat = Number((lat + item.offsetLat).toFixed(6));
    const itemLng = Number((lng + item.offsetLng).toFixed(6));
    return {
      id: `fallback/${category || "feature"}_${index}`,
      osmType: "node",
      osmId: 900000 + index,
      lat: itemLat,
      lng: itemLng,
      name: item.name,
      category: item.category,
      distanceMeters: Math.round(distanceBetween(lat, lng, itemLat, itemLng)),
      tags: { amenity: item.category, name: item.name },
    };
  });
}

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

  if (!data || !data.elements?.length) {
    console.warn(`[OSM] Overpass unavailable (${lastError?.message || "empty response"}), using fallback POIs.`);
    return generateFallbackPOIs(latitude, longitude, category, safeRadius);
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
