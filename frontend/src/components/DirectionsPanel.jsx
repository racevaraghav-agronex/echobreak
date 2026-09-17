import React from "react";

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDuration(s) {
  const mins = Math.round(s / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

const RISK_STYLE = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

export default function DirectionsPanel({ routes, selectedRouteId, onSelectRoute, onStart, onClose }) {
  if (!routes?.length) return null;

  return (
    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 slide-up max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-eco-950">Route Alternatives</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
          ×
        </button>
      </div>

      <div className="space-y-2">
        {routes.map((route) => {
          const risk = route.echobreakRisk || { level: "LOW", message: "Low risk." };
          const selected = selectedRouteId === route.routeId;
          return (
            <button
              key={route.routeId}
              onClick={() => onSelectRoute(route.routeId)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                selected ? "border-eco-950 bg-eco-950/5 shadow-md" : "border-slate-200 hover:border-eco-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-eco-950">
                  {formatDuration(route.durationSeconds)} · {formatDistance(route.distanceMeters)}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${RISK_STYLE[risk.level]}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{risk.message}</p>
            </button>
          );
        })}
      </div>

      <button
        onClick={onStart}
        disabled={!selectedRouteId}
        className="w-full mt-4 bg-eco-950 hover:bg-eco-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition shadow-md cursor-pointer"
      >
        Start navigation
      </button>
    </div>
  );
}
