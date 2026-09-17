const mongoose = require("mongoose");

let isConnecting = false;

/**
 * Connect to MongoDB Atlas. Reuses existing connections across invocations.
 */
async function connectDB() {
  const MONGO_URI = process.env.MONGO_URI;

  const isInvalidOrPlaceholder =
    !MONGO_URI ||
    MONGO_URI.includes("your_mongodb_") ||
    (!MONGO_URI.startsWith("mongodb://") && !MONGO_URI.startsWith("mongodb+srv://"));

  if (isInvalidOrPlaceholder) {
    console.warn("[EchoBreak] Valid MONGO_URI not provided. Operating in high-performance in-memory fallback mode.");
    return null;
  }

  // If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If currently in the process of connecting, wait for completion
  if (mongoose.connection.readyState === 2 || isConnecting) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
    return mongoose.connection;
  }

  isConnecting = true;
  mongoose.set("bufferCommands", false);

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnecting = false;
    console.log(`[EchoBreak] Connected to MongoDB Atlas (${conn.connection.host})`);
    return conn;
  } catch (err) {
    isConnecting = false;
    console.warn("[EchoBreak] MongoDB connection failed, using in-memory store:", err.message);
    return null;
  }
}

module.exports = { connectDB };
