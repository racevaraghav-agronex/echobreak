const mongoose = require("mongoose");

// Disable query buffering so Mongoose operations fail fast instead of hanging for 10000ms
mongoose.set("bufferCommands", false);

let isConnecting = false;
let memoryServerInstance = null;

function isValidMongoUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  if (trimmed.includes("your_mongodb_")) return false;
  return trimmed.startsWith("mongodb://") || trimmed.startsWith("mongodb+srv://");
}

/**
 * Connect to MongoDB Atlas. Reuses existing connections across invocations.
 * In production or serverless environments, a valid MONGO_URI is strictly required.
 * In development, if no external MONGO_URI is supplied, starts a local MongoDB instance.
 */
async function connectDB() {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If currently in the process of connecting, wait for completion
  if (mongoose.connection.readyState === 2 || isConnecting) {
    await new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (mongoose.connection.readyState === 1) {
          clearInterval(interval);
          resolve(mongoose.connection);
        } else if (mongoose.connection.readyState === 0 && !isConnecting) {
          clearInterval(interval);
          reject(new Error("[EchoBreak Database Error] MongoDB connection attempt failed."));
        } else if (Date.now() - start > 10000) {
          clearInterval(interval);
          reject(new Error("[EchoBreak Database Error] MongoDB connection timed out while waiting."));
        }
      }, 50);
    });
    return mongoose.connection;
  }

  isConnecting = true;

  let MONGO_URI = process.env.MONGO_URI;
  const isProduction =
    process.env.NODE_ENV === "production" ||
    !!process.env.NETLIFY ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!isValidMongoUri(MONGO_URI)) {
    if (isProduction) {
      isConnecting = false;
      const errorMsg =
        "[EchoBreak Database Error] Valid MONGO_URI is required in production (must start with mongodb:// or mongodb+srv://). In-memory fallback is strictly disabled.";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // In local development/preview, start a real local MongoDB instance using mongodb-memory-server
    try {
      console.log("[EchoBreak] No production MONGO_URI detected in development. Initializing local MongoDB engine...");
      let MongoMemoryServer;
      try {
        MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;
      } catch (e) {
        MongoMemoryServer = require("../node_modules/mongodb-memory-server").MongoMemoryServer;
      }
      if (!memoryServerInstance) {
        memoryServerInstance = await MongoMemoryServer.create();
      }
      MONGO_URI = memoryServerInstance.getUri();
      process.env.MONGO_URI = MONGO_URI;
      console.log(`[EchoBreak] Local MongoDB engine active at ${MONGO_URI}`);
    } catch (memErr) {
      isConnecting = false;
      const errorMsg = `[EchoBreak Database Error] Valid MONGO_URI is required and local MongoDB could not start: ${memErr.message}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnecting = false;
    console.log(`[EchoBreak] Connected to MongoDB (${conn.connection.host})`);
    return conn;
  } catch (err) {
    isConnecting = false;
    console.error("[EchoBreak Database Error] Failed to connect to MongoDB:", err.message);
    throw new Error(`[EchoBreak Database Error] MongoDB connection failed: ${err.message}`);
  }
}

module.exports = { connectDB, isValidMongoUri };


