const bcrypt = require("bcryptjs");

// In-memory collections used when MongoDB is offline / unconfigured
const users = new Map();
const trafficLogs = [];

function createObjectId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return timestamp + random;
}

// Seed default users if empty
function initMemoryStore() {
  if (users.size === 0) {
    const adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);
    const userPasswordHash = bcrypt.hashSync("user123", 10);

    const adminUser = {
      _id: "650000000000000000000001",
      name: "Administrator",
      email: (process.env.ADMIN_EMAIL || "admin@echobreak.com").toLowerCase(),
      phone: "0000000000",
      password: adminPasswordHash,
      role: "admin",
      vehicleMode: "car",
      currentLocation: { type: "Point", coordinates: [77.209, 28.6139] },
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(adminUser._id, adminUser);

    const demoUser = {
      _id: "650000000000000000000002",
      name: "Delhi Commuter",
      email: "user@echobreak.com",
      phone: "9876543210",
      password: userPasswordHash,
      role: "user",
      vehicleMode: "car",
      currentLocation: { type: "Point", coordinates: [77.212, 28.616] },
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(demoUser._id, demoUser);
  }

  if (trafficLogs.length === 0) {
    trafficLogs.push(
      {
        _id: "650000000000000000000101",
        eventType: "tyre_screech",
        severity: "high",
        confidence: 0.88,
        location: { type: "Point", coordinates: [77.219, 28.628] },
        riskScore: 75,
        trafficState: "HEAVY",
        vehicleMode: "car",
        source: "estimated",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        _id: "650000000000000000000102",
        eventType: "sudden_braking",
        severity: "medium",
        confidence: 0.82,
        location: { type: "Point", coordinates: [77.229, 28.612] },
        riskScore: 60,
        trafficState: "SLOW",
        vehicleMode: "car",
        source: "estimated",
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      },
      {
        _id: "650000000000000000000103",
        eventType: "heavy_vehicle_vibration",
        severity: "low",
        confidence: 0.74,
        location: { type: "Point", coordinates: [77.195, 28.605] },
        riskScore: 35,
        trafficState: "NORMAL",
        vehicleMode: "truck",
        source: "estimated",
        createdAt: new Date(Date.now() - 18 * 60 * 1000),
      }
    );
  }
}

initMemoryStore();

function wrapUserDoc(raw) {
  if (!raw) return null;
  const clone = { ...raw };
  clone.save = async function () {
    clone.updatedAt = new Date();
    users.set(clone._id, { ...clone });
    return clone;
  };
  clone.toObject = () => ({ ...clone });
  clone.toJSON = () => ({ ...clone });
  clone.select = () => clone;
  return clone;
}

function distanceMeters(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeQuery(resolver) {
  let limitNum = null;
  const queryObj = {
    select() { return queryObj; },
    sort() { return queryObj; },
    limit(n) {
      limitNum = n;
      return queryObj;
    },
    populate() { return queryObj; },
    lean() { return queryObj; },
    async exec() {
      const res = await resolver();
      if (Array.isArray(res) && limitNum !== null) {
        return res.slice(0, limitNum);
      }
      return res;
    },
    then(resolve, reject) {
      return Promise.resolve(this.exec()).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(this.exec()).catch(reject);
    },
    finally(fn) {
      return Promise.resolve(this.exec()).finally(fn);
    },
  };
  return queryObj;
}

const MemoryUser = {
  findOne(query = {}) {
    initMemoryStore();
    return makeQuery(() => {
      const userList = Array.from(users.values());

      if (query.$or && Array.isArray(query.$or)) {
        for (const cond of query.$or) {
          const found = userList.find((u) => {
            if (cond.email && u.email.toLowerCase() === cond.email.toLowerCase()) return true;
            if (cond.phone && u.phone === cond.phone) return true;
            return false;
          });
          if (found) return wrapUserDoc(found);
        }
        return null;
      }

      const found = userList.find((u) => {
        if (query.email && u.email.toLowerCase() !== query.email.toLowerCase()) return false;
        if (query.phone && u.phone !== query.phone) return false;
        if (query._id && u._id !== query._id) return false;
        return true;
      });

      return found ? wrapUserDoc(found) : null;
    });
  },

  findById(id) {
    initMemoryStore();
    return makeQuery(() => {
      const found = users.get(String(id));
      return found ? wrapUserDoc(found) : null;
    });
  },

  async findByIdAndUpdate(id, update = {}) {
    initMemoryStore();
    const existing = users.get(String(id));
    if (!existing) return null;
    const updated = { ...existing, ...update, updatedAt: new Date() };
    users.set(String(id), updated);
    return wrapUserDoc(updated);
  },

  async create(data) {
    initMemoryStore();
    const _id = createObjectId();
    const newUser = {
      _id,
      name: data.name,
      email: (data.email || "").toLowerCase(),
      phone: data.phone,
      password: data.password,
      role: data.role || "user",
      vehicleMode: data.vehicleMode || "car",
      currentLocation: data.currentLocation || { type: "Point", coordinates: [0, 0] },
      isOnline: data.isOnline ?? true,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(_id, newUser);
    return wrapUserDoc(newUser);
  },

  find(query = {}) {
    initMemoryStore();
    return makeQuery(() => {
      let result = Array.from(users.values());
      if (query.isOnline !== undefined) {
        result = result.filter((u) => u.isOnline === query.isOnline);
      }
      if (query.currentLocation && query.currentLocation.$near) {
        const near = query.currentLocation.$near;
        const center = near.$geometry?.coordinates;
        const maxDist = near.$maxDistance || 50000;
        if (center) {
          result = result
            .map((u) => ({
              user: u,
              dist: distanceMeters(u.currentLocation?.coordinates || [0, 0], center),
            }))
            .filter((item) => item.dist <= maxDist)
            .sort((a, b) => a.dist - b.dist)
            .map((item) => item.user);
        }
      }
      return result.map(wrapUserDoc);
    });
  },

  async countDocuments(query = {}) {
    initMemoryStore();
    let result = Array.from(users.values());
    if (query.isOnline !== undefined) {
      result = result.filter((u) => u.isOnline === query.isOnline);
    }
    return result.length;
  },
};

const MemoryTrafficLog = {
  async create(data) {
    initMemoryStore();
    const log = {
      _id: createObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    trafficLogs.unshift(log);
    return log;
  },

  find(query = {}) {
    initMemoryStore();
    let limitNum = null;
    const queryObj = {
      select() { return queryObj; },
      sort() { return queryObj; },
      populate() { return queryObj; },
      lean() { return queryObj; },
      limit(n) {
        limitNum = n;
        return queryObj;
      },
      exec() {
        let result = [...trafficLogs];
        if (query.createdAt && query.createdAt.$gte) {
          const since = new Date(query.createdAt.$gte).getTime();
          result = result.filter((l) => new Date(l.createdAt).getTime() >= since);
        }
        if (query.eventType) {
          if (typeof query.eventType === "object" && query.eventType.$in) {
            result = result.filter((l) => query.eventType.$in.includes(l.eventType));
          } else if (typeof query.eventType === "string") {
            result = result.filter((l) => l.eventType === query.eventType);
          }
        }
        if (query.source) {
          result = result.filter((l) => l.source === query.source);
        }
        if (query.location && query.location.$near) {
          const near = query.location.$near;
          const center = near.$geometry?.coordinates;
          const maxDist = near.$maxDistance || 50000;
          if (center) {
            result = result
              .map((l) => ({
                log: l,
                dist: distanceMeters(l.location?.coordinates || [0, 0], center),
              }))
              .filter((item) => item.dist <= maxDist)
              .sort((a, b) => a.dist - b.dist)
              .map((item) => item.log);
          }
        }
        if (limitNum !== null) {
          result = result.slice(0, limitNum);
        }
        return Promise.resolve(result);
      },
      then(resolve, reject) {
        return this.exec().then(resolve, reject);
      },
      catch(reject) {
        return this.exec().catch(reject);
      },
      finally(fn) {
        return this.exec().finally(fn);
      },
    };
    return queryObj;
  },

  async countDocuments(query = {}) {
    initMemoryStore();
    let result = [...trafficLogs];
    if (query.createdAt && query.createdAt.$gte) {
      const since = new Date(query.createdAt.$gte).getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() >= since);
    }
    if (query.eventType) {
      if (typeof query.eventType === "object" && query.eventType.$ne) {
        result = result.filter((l) => l.eventType !== query.eventType.$ne);
      } else if (typeof query.eventType === "string") {
        result = result.filter((l) => l.eventType === query.eventType);
      }
    }
    if (query.riskScore && query.riskScore.$gte !== undefined) {
      result = result.filter((l) => (l.riskScore || 0) >= query.riskScore.$gte);
    }
    return result.length;
  },
};

module.exports = { MemoryUser, MemoryTrafficLog };
