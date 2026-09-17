import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./components/Login";
import Signup from "./components/Signup";
import AdminDashboard from "./components/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("echobreak_user")) || null;
  } catch {
    return null;
  }
}

function ProtectedRoute({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());

  const handleAuthSuccess = (u) => {
    localStorage.setItem("echobreak_user", JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("echobreak_token");
    localStorage.removeItem("echobreak_user");
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onAuthSuccess={handleAuthSuccess} />} />
        <Route path="/signup" element={<Signup onLogin={handleAuthSuccess} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} role="user">
              <UserDashboard user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} role="admin">
              <AdminDashboard user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
