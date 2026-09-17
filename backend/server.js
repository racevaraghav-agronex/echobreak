require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/authRoutes");
const trafficRoutes = require("./routes/trafficRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { initSocket } = require("./utils/socket");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = { origin: CLIENT_ORIGINS, credentials: true };

const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
app.use("/api/", apiLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "echobreak-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/admin", adminRoutes);

// Fallback 404 for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ message: "Endpoint not found." }));

// Generic error handler — never leak stack traces
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Internal server error." });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set. Please configure your .env file.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB.");
    server.listen(PORT, () => console.log(`Echobreak backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
