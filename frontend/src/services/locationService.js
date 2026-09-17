/**
 * Wraps the browser Geolocation API with sane defaults, cleanup, and
 * permission/error handling that the UI can react to.
 */

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(normalize(pos)),
      (err) => reject(new Error(mapGeoError(err))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error("Geolocation is not supported on this device."));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate(normalize(pos)),
    (err) => onError?.(new Error(mapGeoError(err))),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

function normalize(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    speed: pos.coords.speed || 0, // m/s
    heading: pos.coords.heading || 0,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

function mapGeoError(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Please enable it to use navigation.";
    case err.POSITION_UNAVAILABLE:
      return "Location currently unavailable.";
    case err.TIMEOUT:
      return "Location request timed out.";
    default:
      return "Unable to get your location.";
  }
}
