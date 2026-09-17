function createScenarioVehicles({ lat = 28.6139, lng = 77.209, count = 4 } = {}) {
  const speeds = [60, 55, 90, 40];
  return Array.from({ length: count }, (_, index) => ({
    lat: lat + (index - 1.5) * 0.001,
    lng: lng + (index % 2 ? 0.001 : -0.001),
    speed: speeds[index % speeds.length] / 3.6,
    heading: index % 2 ? 90 : 270,
    acceleration: index === 2 ? -4 : 0,
    routeId: `simulation-route-${index + 1}`,
    hasDestination: true,
  }));
}

module.exports = { createScenarioVehicles };