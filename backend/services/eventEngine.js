const cooldowns = new Map();

function eventKey(event) {
  return `${event.type}:${event.affectedVehicleSessionId || "area"}`;
}

function publishEvent(event, emit) {
  const now = Date.now();
  const key = eventKey(event);
  const previous = cooldowns.get(key) || 0;
  if (now - previous < (event.cooldownMs || 10000)) return false;
  cooldowns.set(key, now);
  emit({
    ...event,
    timestamp: new Date(now).toISOString(),
    expiresAt: event.expiresAt || new Date(now + 10000).toISOString(),
  });
  return true;
}

function cleanupEventCooldowns() {
  const cutoff = Date.now() - 120000;
  for (const [key, timestamp] of cooldowns) if (timestamp < cutoff) cooldowns.delete(key);
}

const cleanupTimer = setInterval(cleanupEventCooldowns, 30000);
cleanupTimer.unref?.();

module.exports = { publishEvent, cleanupEventCooldowns };