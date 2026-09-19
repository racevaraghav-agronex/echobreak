require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const app = require("./app");
const { connectDB } = require("./config/db");
const { initSocket } = require("./utils/socket");

// Serve frontend static assets
const frontendDist = path.resolve(__dirname, "../frontend/dist");
const indexPath = path.join(frontendDist, "index.html");

if (!fs.existsSync(indexPath)) {
  try {
    console.log("[EchoBreak] Frontend assets not found. Building frontend...");
    const { execSync } = require("child_process");
    execSync("cd frontend && npm run build", {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
    console.log("[EchoBreak] Frontend build completed successfully.");
  } catch (err) {
    console.warn("[EchoBreak] Frontend build note:", err.message);
  }
}

app.use(express.static(frontendDist));

// SPA fallback for all non-API GET requests
app.get("*", (req, res) => {
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res
    .status(200)
    .send(
      "<!doctype html><html><head><meta http-equiv='refresh' content='2'></head><body style='font-family:sans-serif;padding:2rem;'><h2>Loading Echobreak...</h2><p>Please wait while assets initialize.</p></body></html>"
    );
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initSocket(io);

const PORT = 3000;

// Start server immediately so port 3000 is open without delay
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Echobreak running on http://0.0.0.0:${PORT}`);
});

// Connect to MongoDB in parallel
connectDB()
  .then((conn) => {
    if (conn) {
      console.log("[EchoBreak] Database initialization verified.");
    }
  })
  .catch((err) => {
    console.warn("[EchoBreak] Database connection warning:", err.message);
  });

