require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/authRoutes");
const trafficRoutes = require("./routes/trafficRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.set("trust proxy", 1);

const corsOptions = {
  origin: (origin, callback) => {
    // If no origin (e.g. server-to-server, curl, same-origin), allow
    if (!origin) return callback(null, true);

    const clientOrigin = process.env.CLIENT_ORIGIN;
    if (clientOrigin && clientOrigin !== "*") {
      const allowed = clientOrigin.split(",").map((s) => s.trim());
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
    }

    // Always permit localhost, Cloud Run preview, Netlify domains, or during development
    if (
      !clientOrigin ||
      clientOrigin === "*" ||
      process.env.NODE_ENV !== "production" ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.endsWith(".run.app") ||
      origin.endsWith(".netlify.app")
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: "Too many requests. Please slow down." },
});

// Setup API router
const apiRouter = express.Router();
apiRouter.use(apiLimiter);

apiRouter.get("/health", (req, res) =>
  res.json({ status: "ok", service: "echobreak-backend" })
);

apiRouter.use("/auth", authRoutes);
apiRouter.use("/traffic", trafficRoutes);
apiRouter.use("/admin", adminRoutes);

// Fallback 404 for unknown API routes
apiRouter.use((req, res) =>
  res.status(404).json({ message: "Endpoint not found." })
);

// Mount on standard /api as well as Netlify function base path
app.use("/api", apiRouter);
app.use("/.netlify/functions/api", apiRouter);

// Error handler
app.use((err, req, res, next) => {
  if (
    err.name === "MongooseError" ||
    err.name === "MongoNetworkError" ||
    err.name === "MongoServerSelectionError" ||
    err.message?.includes("buffering timed out") ||
    err.message?.includes("ECONNREFUSED") ||
    err.message?.includes("database offline")
  ) {
    console.error("[EchoBreak] Database error:", err.message);
    return res.status(503).json({
      status: 503,
      error: "Service Unavailable",
      message: "Database connection failed. Please ensure MONGO_URI is configured correctly.",
    });
  }

  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Internal server error." });
});


module.exports = app;
