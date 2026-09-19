const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;
let mongoUri;
let app;
let server;
let baseUrl;
let User;
let connectDB;

test.before(async () => {
  // 1. Spin up MongoDB server
  mongod = await MongoMemoryServer.create();
  mongoUri = mongod.getUri();
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = "echobreak-test-production-secret-999";
  process.env.JWT_EXPIRES_IN = "2d";
  process.env.ADMIN_EMAIL = "system.admin@echobreak.com";
  process.env.ADMIN_PASSWORD = "production-admin-pass-xyz";

  // 2. Connect via app's connectDB
  const dbConfig = require("../config/db");
  connectDB = dbConfig.connectDB;
  await connectDB();

  User = require("../models/User");
  app = require("../app");

  // 3. Start local HTTP test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

async function apiRequest(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("E: Verify MongoDB connection succeeds with a real MONGO_URI", async () => {
  assert.equal(mongoose.connection.readyState, 1);
  assert.ok(mongoose.connection.host);
});

test("D: Verify /api/health", async () => {
  const { status, data } = await apiRequest("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(data.status, "ok");
  assert.equal(data.service, "echobreak-backend");
});

test("F & G: Test signup and verify user is permanently created in MongoDB", async () => {
  const uniqueEmail = `driver_${Date.now()}@echobreak.test`;
  const uniquePhone = "9876543210";

  const { status, data } = await apiRequest("POST", "/api/auth/signup", {
    name: "Aarav Sharma",
    email: uniqueEmail,
    phone: uniquePhone,
    password: "securePassword@123",
  });

  assert.equal(status, 201, `Signup failed: ${JSON.stringify(data)}`);
  assert.ok(data.token, "Token should be returned on signup");
  assert.equal(data.user.email, uniqueEmail);
  assert.equal(data.user.name, "Aarav Sharma");
  assert.equal(data.user.phone, uniquePhone);
  assert.equal(data.user.role, "user");
  assert.equal(data.user.password, undefined, "Password must not be returned in sanitized user");

  // G: Verify that the created user exists directly in MongoDB collection
  const mongoDoc = await User.findOne({ email: uniqueEmail }).select("+password");
  assert.ok(mongoDoc, "User document must exist in MongoDB");
  assert.equal(mongoDoc.email, uniqueEmail);
  assert.equal(mongoDoc.name, "Aarav Sharma");
  assert.notEqual(mongoDoc.password, "securePassword@123", "Password in MongoDB must be hashed with bcrypt");
  assert.ok(mongoDoc.password.startsWith("$2"), "Password hash format check");
});

test("H: Test login using the same email and password", async () => {
  const email = "login_test@echobreak.test";
  const phone = "9123456780";
  const password = "mySecretPassword456";

  // Signup first
  const signupRes = await apiRequest("POST", "/api/auth/signup", {
    name: "Priya Patel",
    email,
    phone,
    password,
  });
  assert.equal(signupRes.status, 201);

  // Login with email
  const loginRes = await apiRequest("POST", "/api/auth/login", {
    identifier: email,
    password,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);
  assert.equal(loginRes.data.user.email, email);
  assert.equal(loginRes.data.user.name, "Priya Patel");

  // Login with phone
  const phoneLoginRes = await apiRequest("POST", "/api/auth/login", {
    identifier: phone,
    password,
  });
  assert.equal(phoneLoginRes.status, 200);
  assert.ok(phoneLoginRes.data.token);
  assert.equal(phoneLoginRes.data.user.phone, phone);
});

test("I: Serverless invocation reinitialization: user retrieved from MongoDB across invocations", async () => {
  const email = "persistent_user@echobreak.test";
  const phone = "9988776655";
  const password = "persistentPassword789";

  // 1. Create user in current invocation
  const signup = await apiRequest("POST", "/api/auth/signup", {
    name: "Rohan Gupta",
    email,
    phone,
    password,
  });
  assert.equal(signup.status, 201);

  // 2. Disconnect mongoose to simulate an invocation termination/container teardown
  await mongoose.disconnect();
  assert.equal(mongoose.connection.readyState, 0, "Mongoose should be disconnected");

  // 3. Connect again simulating a fresh cold-start serverless invocation
  await connectDB();
  assert.equal(mongoose.connection.readyState, 1, "Mongoose reconnected successfully");

  // 4. Test login on fresh invocation
  const login = await apiRequest("POST", "/api/auth/login", {
    identifier: email,
    password,
  });
  assert.equal(login.status, 200, "Login must succeed after fresh invocation");
  assert.ok(login.data.token);
  assert.equal(login.data.user.email, email);
  assert.equal(login.data.user.name, "Rohan Gupta");
});

test("J & K: Admin login creates/finds admin in MongoDB and grants admin role", async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Verify admin doesn't exist yet in MongoDB
  const initialAdmin = await User.findOne({ email: adminEmail });
  assert.equal(initialAdmin, null, "Admin user must not exist before first admin login");

  // J: Test admin login using ADMIN_EMAIL and ADMIN_PASSWORD
  const adminLoginRes = await apiRequest("POST", "/api/auth/login", {
    identifier: adminEmail,
    password: adminPassword,
  });
  assert.equal(adminLoginRes.status, 200);
  assert.ok(adminLoginRes.data.token);
  assert.equal(adminLoginRes.data.user.role, "admin");
  assert.equal(adminLoginRes.data.user.email, adminEmail);

  // K: Verify admin user exists in MongoDB
  const adminInDb = await User.findOne({ email: adminEmail });
  assert.ok(adminInDb, "Admin user document must now exist in MongoDB");
  assert.equal(adminInDb.role, "admin");
  assert.equal(adminInDb.email, adminEmail);

  // Test admin dashboard access with the admin token
  const adminMetricsRes = await apiRequest("GET", "/api/admin/metrics", null, {
    Authorization: `Bearer ${adminLoginRes.data.token}`,
  });
  assert.equal(adminMetricsRes.status, 200);
  assert.ok(adminMetricsRes.data.totalUsers >= 1);
});

test("L: Duplicate signup returns conflict for existing email and phone", async () => {
  const email = "dup_test@echobreak.test";
  const phone = "9445566778";

  const firstSignup = await apiRequest("POST", "/api/auth/signup", {
    name: "Dup User",
    email,
    phone,
    password: "password123",
  });
  assert.equal(firstSignup.status, 201);

  // Duplicate email
  const dupEmail = await apiRequest("POST", "/api/auth/signup", {
    name: "Other User",
    email,
    phone: "9111122223",
    password: "password123",
  });
  assert.equal(dupEmail.status, 409);
  assert.match(dupEmail.data.message, /account with this email already exists/i);

  // Duplicate phone
  const dupPhone = await apiRequest("POST", "/api/auth/signup", {
    name: "Other User 2",
    email: "different@echobreak.test",
    phone,
    password: "password123",
  });
  assert.equal(dupPhone.status, 409);
  assert.match(dupPhone.data.message, /account with this phone number already exists/i);
});

test("M: Verify auth regressions (incorrect passwords, nonexistent accounts, protected routes)", async () => {
  // Wrong password
  const wrongPass = await apiRequest("POST", "/api/auth/login", {
    identifier: "dup_test@echobreak.test",
    password: "wrongPassword!",
  });
  assert.equal(wrongPass.status, 401);
  assert.match(wrongPass.data.message, /incorrect password/i);

  // Nonexistent user
  const notFound = await apiRequest("POST", "/api/auth/login", {
    identifier: "ghost_user@echobreak.test",
    password: "password123",
  });
  assert.equal(notFound.status, 404);
  assert.match(notFound.data.message, /account not found/i);

  // Protected route /api/auth/me without token
  const noAuth = await apiRequest("GET", "/api/auth/me");
  assert.equal(noAuth.status, 401);

  // Protected route with valid user token
  const validLogin = await apiRequest("POST", "/api/auth/login", {
    identifier: "dup_test@echobreak.test",
    password: "password123",
  });
  const meRes = await apiRequest("GET", "/api/auth/me", null, {
    Authorization: `Bearer ${validLogin.data.token}`,
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.email, "dup_test@echobreak.test");

  // Non-admin accessing admin route gets 403
  const nonAdminRoute = await apiRequest("GET", "/api/admin/metrics", null, {
    Authorization: `Bearer ${validLogin.data.token}`,
  });
  assert.equal(nonAdminRoute.status, 403);
});
