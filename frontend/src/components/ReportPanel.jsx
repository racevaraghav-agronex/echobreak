import React, { useState } from "react";
import api from "../utils/api";

const REPORT_TYPES = [
  { id: "accident", label: "Accident / Hazard", emoji: "🚨" },
  { id: "blockage", label: "Road Blockage", emoji: "🚧" },
  { id: "congestion", label: "Congestion", emoji: "🚦" },
  { id: "construction", label: "Construction", emoji: "🏗️" },
  { id: "unusual_traffic", label: "Unusual Traffic", emoji: "❗" },
  { id: "acoustic_anomaly", label: "Acoustic Anomaly", emoji: "🔊" },
  { id: "map_error", label: "Map Error", emoji: "🗺️" },
];

export default function ReportPanel({ location, onClose, onSubmitted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (reportType) => {
    if (!location) {
      setError("Current location is unavailable, so this report can't be pinned. Please try again once location is on.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/traffic/report", { reportType, lat: location.lat, lng: location.lng });
      setDone(true);
      onSubmitted?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-end sm:items-center justify-center fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-5 slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-eco-950">Report an issue</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {done ? (
          <p className="text-emerald-700 text-sm font-medium py-6 text-center">Thanks — your report was submitted.</p>
        ) : (
          <>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.id}
                  disabled={submitting}
                  onClick={() => submit(t.id)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 hover:border-eco-600 py-3 disabled:opacity-50"
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-[11px] font-medium text-slate-700 text-center px-1">{t.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
