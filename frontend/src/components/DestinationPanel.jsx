import React from "react";
import VehicleSelector from "./VehicleSelector";

function formatDistance(m) {
  if (m == null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDuration(s) {
  if (s == null) return "—";
  const mins = Math.round(s / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

export default function DestinationPanel({
  destination,
  vehicleMode,
  onSelectVehicle,
  bestRoute,
  loadingRoutes,
  routeError,
  onGetDirections,
  onClose,
}) {
  if (!destination) return null;

  return (
    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 slide-up">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg text-eco-950">{destination.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{destination.address}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none">
          ×
        </button>
      </div>

      {bestRoute && (
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="font-semibold text-eco-950">{formatDistance(bestRoute.distanceMeters)}</span>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-eco-950">{formatDuration(bestRoute.durationSeconds)}</span>
          {bestRoute.echobreakRisk && (
            <span
              className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
                bestRoute.echobreakRisk.level === "LOW"
                  ? "bg-emerald-50 text-emerald-700"
                  : bestRoute.echobreakRisk.level === "MEDIUM"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {bestRoute.echobreakRisk.level} risk
            </span>
          )}
        </div>
      )}

      {routeError && <p className="text-xs text-red-600 mt-2">{routeError}</p>}

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Vehicle</p>
        <VehicleSelector selected={vehicleMode} onSelect={onSelectVehicle} />
      </div>

      <button
        onClick={onGetDirections}
        disabled={loadingRoutes}
        className="w-full mt-4 bg-eco-950 hover:bg-eco-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-md cursor-pointer"
      >
        {loadingRoutes ? "Finding routes." : "Preview route"}
      </button>
    </div>
  );
}
