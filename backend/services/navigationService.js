/**
 * Navigation / FIFO recovery helper logic (backend side).
 * The actual turn-by-turn engine runs client-side against route geometry +
 * live GPS (see frontend/src/services/mapService.js); this module tracks
 * segment-level recovery state so multiple connected users in the same
 * queue get a consistent, sequential ("first in, first out") advisory.
 */

const activeRecoveries = new Map(); // key: rounded lat,lng -> { startedAt, stage }

function segmentKey(lat, lng) {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

function startOrUpdateRecovery({ lat, lng, congestionFactor }) {
  const key = segmentKey(lat, lng);
  const existing = activeRecoveries.get(key);

  if (congestionFactor < 55) {
    if (existing) activeRecoveries.delete(key);
    return { recoveryMode: false };
  }

  if (!existing) {
    activeRecoveries.set(key, { startedAt: Date.now(), stage: "queue_detected" });
    return { recoveryMode: true, stage: "queue_detected" };
  }

  const elapsed = Date.now() - existing.startedAt;
  let stage = existing.stage;
  if (elapsed > 90_000) stage = "flow_recovery";
  else if (elapsed > 30_000) stage = "controlled_sequential_advisory";

  activeRecoveries.set(key, { ...existing, stage });
  return { recoveryMode: true, stage };
}

module.exports = { startOrUpdateRecovery, segmentKey };
