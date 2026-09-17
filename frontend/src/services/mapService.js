/**
 * Pure geometry helpers used by live navigation: distance/bearing math and
 * off-route detection against the active route's GeoJSON LineString.
 */

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineDistance([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing([lng1, lat1], [lng2, lat2]) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Returns the shortest distance (meters) from a point to the route line, and the closest point index. */
export function distanceToRoute(point, routeCoords) {
  let minDist = Infinity;
  let closestIndex = 0;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = haversineDistance(point, routeCoords[i]);
    if (d < minDist) {
      minDist = d;
      closestIndex = i;
    }
  }
  return { distance: minDist, index: closestIndex };
}

const OFF_ROUTE_THRESHOLD_METERS = 40;

export function isOffRoute(point, routeCoords) {
  const { distance } = distanceToRoute(point, routeCoords);
  return distance > OFF_ROUTE_THRESHOLD_METERS;
}

/** Finds the next maneuver step given current progress along the route. */
export function findNextStep(steps, progressIndex, routeCoords) {
  if (!steps?.length) return null;
  // Find the step whose location is nearest ahead of current progress
  let best = null;
  let bestDist = Infinity;
  for (const step of steps) {
    if (!step.location) continue;
    const stepIdx = distanceToRoute(step.location, routeCoords).index;
    if (stepIdx >= progressIndex) {
      const d = stepIdx - progressIndex;
      if (d < bestDist) {
        bestDist = d;
        best = step;
      }
    }
  }
  return best || steps[steps.length - 1];
}
