const serverless = require("serverless-http");
const app = require("../../backend/app");
const { connectDB } = require("../../backend/config/db");

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const isHealthCheck =
    event.path &&
    (event.path.endsWith("/health") || event.path.endsWith("/health/"));

  try {
    await connectDB();
  } catch (err) {
    console.error("[Netlify Function] Database connection error:", err.message);
    if (!isHealthCheck) {
      return {
        statusCode: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          status: 503,
          error: "Service Unavailable",
          message: "Database connection failed. Please ensure MONGO_URI is configured correctly.",
        }),
      };
    }
  }

  return handler(event, context);
};

