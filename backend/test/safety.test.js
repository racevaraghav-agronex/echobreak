const test = require("node:test");
const assert = require("node:assert/strict");
const { validateUpdate } = require("../services/vehicleStateService");
const { calculateCollisionRisk } = require("../services/collisionRiskService");
const { analyzeVehicleFlow } = require("../services/trafficFlowService");
const { publishEvent, cleanupEventCooldowns } = require("../services/eventEngine");
const { createScenarioVehicles } = require("../services/vehicleSimulationService");

test("vehicle updates validate coordinates and clamp unsafe inputs", () => {
  assert.equal(validateUpdate({ lat: 91, lng: 77 }).ok, false);
  const result = validateUpdate({ lat: 28, lng: 77, speed: 200, acceleration: -30 });
  assert.equal(result.ok, true);
  assert.equal(result.value.speed, 100);
  assert.equal(result.value.acceleration, -20);
});

test("collision engine reports high risk only from converging signals", () => {
  const event = calculateCollisionRisk({ lat: 28, lng: 77, speed: 25, acceleration: 0 }, { lat: 28, lng: 77.0001, speed: 5, acceleration: -4 });
  assert.equal(event.type, "COLLISION_RISK");
  assert.equal(event.severity, "HIGH");
  assert.ok(event.timeToCollisionSeconds != null);
  assert.match(event.message, /maintain a safe following distance/i);
});

test("flow analysis returns bounded advisory and confidence", () => {
  const flow = analyzeVehicleFlow(createScenarioVehicles({ count: 4 }));
  assert.equal(flow.vehicleCount, 4);
  assert.ok(flow.recommendedSpeedKph <= 80);
  assert.ok(flow.confidence >= 0 && flow.confidence <= 1);
  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(flow.trafficRisk));
});

test("event engine deduplicates events during cooldown", () => {
  cleanupEventCooldowns();
  let sent = 0;
  const event = { type: "TEST_EVENT", affectedVehicleSessionId: "vehicle-1", cooldownMs: 60000 };
  assert.equal(publishEvent(event, () => { sent += 1; }), true);
  assert.equal(publishEvent(event, () => { sent += 1; }), false);
  assert.equal(sent, 1);
});