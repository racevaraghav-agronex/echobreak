import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";

export default function Login({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", { identifier, password });

      localStorage.setItem("echobreak_token", data.token);
      localStorage.setItem("echobreak_user", JSON.stringify(data.user));
      onAuthSuccess(data.user);

      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-gray-900">
      <div className="h-2 w-full bg-[#0f382b]" />

      <div className="flex-1 w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/favicon.png"
              alt="Echobreak"
              className="w-14 h-14 rounded-xl shadow-md mb-3"
            />
            <h1 className="text-2xl font-bold text-[#0f382b] tracking-tight">
              Echobreak
            </h1>
            <p className="text-[#1b4d3e] text-sm mt-1">
              Acoustic Traffic Intelligence
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm mb-1 font-medium">
                Email or Phone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="Email or Phone"
                className="w-full rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 px-4 py-3 outline-none focus:ring-2 focus:ring-[#0f382b] focus:border-[#0f382b] transition"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm mb-1 font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 px-4 py-3 outline-none focus:ring-2 focus:ring-[#0f382b] focus:border-[#0f382b] transition"
              />
            </div>

            {error && (
              <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0f382b] hover:bg-[#1b4d3e] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-md cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-[#0f382b] font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
