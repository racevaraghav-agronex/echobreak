import api from "../utils/api";

const reverseCache = new Map();

export async function reverseGeocodeCoordinates(lat, lng) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key);

  const request = api
    .get("/traffic/reverse-geocode", { params: { lat, lng } })
    .then(({ data }) => data)
    .catch((error) => {
      reverseCache.delete(key);
      throw error;
    });

  reverseCache.set(key, request);
  if (reverseCache.size > 100) reverseCache.delete(reverseCache.keys().next().value);
  return request;
}