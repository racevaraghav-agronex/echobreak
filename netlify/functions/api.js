const serverless = require("serverless-http");
const app = require("../../backend/app");
const { connectDB } = require("../../backend/config/db");

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();
  } catch (err) {
    console.error("[Netlify Function] Database connection error:", err.message);
  }

  return handler(event, context);
};
