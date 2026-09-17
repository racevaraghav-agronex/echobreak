import React from "react";

const MANEUVER_ICON = {
  turn: "↰",
  "new name": "↑",
  depart: "↑",
  arrive: "🏁",
  merge: "↗",
  "on ramp": "↗",
  "off ramp": "↘",
  fork: "⑂",
  roundabout: "↻",
  continue: "↑",
  "end of road": "↰",
  uturn: "↶",
};

function formatDistance(m) {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDuration(s) {
  if (s == null) return "";
  const mins = Math.round(s / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

export default function NavigationHUD({
  nextStep,
  distanceRemaining,
  durationRemaining,
  currentSpeedKph,
  voiceOn,
  onToggleVoice,
  onRecenter,
  onExit,
  rerouting,
  pacingAdvice,
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex flex-col gap-2 p-3">
      <div className="bg-eco-950 text-white rounded-2xl shadow-xl p-4 flex items-center gap-4">
        <span className="text-3xl">{MANEUVER_ICON[nextStep?.instruction] || "↑"}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">
            {rerouting ? "Recalculating route…" : nextStep?.roadName || "Continue on route"}
          </p>
          <p className="text-eco-400 text-xs">{formatDistance(nextStep?.distanceMeters)} ahead</p>
        </div>
        <button
          onClick={onToggleVoice}
          aria-label="Toggle voice guidance"
          className="bg-white/10 hover:bg-white/20 rounded-xl w-10 h-10 flex items-center justify-center text-lg"
        >
          {voiceOn ? "🔊" : "🔇"}
        </button>
      </div>

      {pacingAdvice && (
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-md px-4 py-2 text-xs font-medium text-eco-950 fade-in">
          <div>{pacingAdvice.instruction} · {pacingAdvice.reason}</div>
          {pacingAdvice.recommendedSpeedKph != null && <div className="mt-1 font-semibold">Recommended speed: {pacingAdvice.recommendedSpeedKph} km/h · Traffic risk: {pacingAdvice.trafficRisk || "LOW"} · Confidence: {Math.round((pacingAdvice.confidence || 0) * 100)}%</div>}
        </div>
      )}

      <div className="flex items-center justify-between text-white">
        <div className="bg-eco-950/90 backdrop-blur rounded-xl px-3 py-1.5 text-xs font-semibold shadow">
          {formatDuration(durationRemaining)} · {formatDistance(distanceRemaining)}
        </div>
        <div className="bg-eco-950/90 backdrop-blur rounded-xl px-3 py-1.5 text-xs font-semibold shadow">
          {Math.round(currentSpeedKph || 0)} km/h
        </div>
      </div>

      <div className="flex justify-between mt-1">
        <button
          onClick={onExit}
          className="bg-white shadow-lg rounded-full px-4 py-2 text-xs font-semibold text-red-600 pointer-events-auto"
        >
          Exit
        </button>
        <button
          onClick={onRecenter}
          aria-label="Recenter map"
          className="bg-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center pointer-events-auto"
        >
          🎯
        </button>
      </div>
    </div>
  );
}
