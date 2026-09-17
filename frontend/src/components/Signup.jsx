import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";

export default function Signup({ onLogin }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    // 10 digit phone number validation
    if (!phone || phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/auth/signup", {
        name,
        email,
        password,
        phone,
      });

      if (data && data.token) {
        localStorage.setItem("echobreak_token", data.token);
        if (onLogin) onLogin(data.user);
        navigate("/dashboard");
      } else {
        setError(data.message || "Signup failed. Please try again.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.response?.data?.message || "An error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-eco-950">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <img src="/favicon.png" alt="Echobreak" className="w-12 h-12 mx-auto rounded-2xl shadow-md" />
          <h1 className="text-2xl font-bold tracking-tight text-eco-950">Create an Account</h1>
          <p className="text-sm text-slate-500">Join Echobreak Acoustic Traffic Intelligence</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1 uppercase">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ritesh Kumar"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-eco-600"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1 uppercase">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@echobreak.com"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-eco-600"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1 uppercase">Phone Number (10 Digits)</label>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-eco-600"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1 uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-eco-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-eco-950 hover:bg-eco-800 text-white font-semibold py-3.5 rounded-xl shadow-lg transition cursor-pointer text-sm"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="text-center text-sm text-slate-500 pt-2">
          Already have an account?{" "}
          <Link to="/login" className="text-eco-900 font-bold hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
