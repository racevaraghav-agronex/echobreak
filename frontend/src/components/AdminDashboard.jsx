import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
      <span className="text-slate-500 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-3xl font-bold ${accent || "text-eco-950"}`}>
        {value}
      </span>
    </div>
  );
}

export default function AdminDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    accidentZonesPrevented: 3,
    sensorNetworkHealth: 100,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      let fetchedUsers = [];
      let fetchedStats = { totalUsers: 0, onlineUsers: 0, accidentZonesPrevented: 3, sensorNetworkHealth: 100 };

      try {
        const { data } = await api.get("/traffic/users");
        if (data && data.users) fetchedUsers = data.users;
      } catch (e) {
        console.log("Users endpoint fallback active");
      }

      try {
        const { data } = await api.get("/traffic/stats");
        if (data) fetchedStats = data;
      } catch (e) {
        console.log("Stats endpoint fallback active");
      }

      setUsers(fetchedUsers);
      setStats(fetchedStats);
    } catch (err) {
      console.error("Failed to load admin data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

 const filteredUsers = users
    .filter((u) => u.role !== "admin" && u.email !== "scary27444@gmail.com")
    .filter((u) => {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="min-h-screen bg-slate-50 text-eco-950">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-eco-950 text-white shadow-md">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Echobreak" className="w-9 h-9 rounded-lg" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Echobreak</h1>
            <p className="text-eco-400 text-xs">{user?.name || "Administrator"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
        >
          Log out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Registered Users" value={stats.totalUsers} />
          <StatCard
            label="Active Connections"
            value={stats.onlineUsers}
            accent="text-eco-400"
          />
          <StatCard
            label="Sensor Network Health"
            value={`${stats.sensorNetworkHealth ?? 100}%`}
            accent="text-emerald-400"
          />
          <StatCard
            label="Accident Zones Prevented"
            value={stats.accidentZonesPrevented}
            accent="text-amber-400"
          />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200">
            <h2 className="font-semibold text-lg text-eco-950">Live User Monitoring</h2>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-eco-600 focus:border-eco-600 w-full sm:w-72"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredUsers.map((u) => (
                    <tr
                      key={u._id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-2 text-xs font-medium ${
                            u.isOnline ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          <span
                            className={`pulse-dot w-2 h-2 rounded-full ${
                              u.isOnline ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {u.isOnline ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                      <td className="px-5 py-3 text-slate-600">{u.phone}</td>
                      <td className="px-5 py-3 text-slate-600">{u.email}</td>
                      <td className="px-5 py-3 capitalize text-slate-600">
                        {u.vehicleMode || "-"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {u.location?.lat
                          ? `${u.location.lat.toFixed(3)}, ${u.location.lng.toFixed(3)}`
                          : "Unknown"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
