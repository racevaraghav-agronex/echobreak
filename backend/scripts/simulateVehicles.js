const { io } = require("socket.io-client");
const { createScenarioVehicles } = require("../services/vehicleSimulationService");

const socketUrl = process.env.SOCKET_URL || "http://localhost:5000";
const count = Math.max(1, Math.min(20, Number(process.env.SIMULATION_COUNT) || 4));
const origin = { lat: Number(process.env.SIMULATION_LAT) || 28.6139, lng: Number(process.env.SIMULATION_LNG) || 77.209 };
const vehicles = createScenarioVehicles({ ...origin, count });
const clients = vehicles.map(() => io(socketUrl, { transports: ["websocket"] }));

function sendUpdates() {
  vehicles.forEach((vehicle, index) => {
    vehicle.lng += (index % 2 ? 1 : -1) * 0.00003;
    clients[index].emit("user:location", vehicle);
  });
}

clients.forEach((client, index) => client.on("connect", () => console.log(`Simulation vehicle ${index + 1} connected.`)));
const interval = setInterval(sendUpdates, 1000);
sendUpdates();
console.log(`Simulating ${count} anonymous vehicles against ${socketUrl}. Press Ctrl+C to stop.`);

function shutdown() {
  clearInterval(interval);
  clients.forEach((client) => client.close());
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);