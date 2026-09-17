import React from "react";

const SEVERITY_STYLE = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
};

const EVENT_LABEL = {
  tyre_screech: "Tyre screech pattern",
  sudden_braking: "Sudden braking sound",
  abnormal_engine: "Abnormal engine sound",
  collision_like: "Collision-like acoustic event",
  proximity_echo_anomaly: "Proximity echo anomaly",
  heavy_vehicle_vibration: "Heavy vehicle vibration",
  road_blockage_acoustic: "Road blockage acoustic anomaly",
};

export default function AcousticWarning({ event, onDismiss }) {
  if (!event) return null;
  const style = SEVERITY_STYLE[event.level] || SEVERITY_STYLE.LOW;

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 top-24 z-40 w-[92%] sm:w-96 rounded-2xl border shadow-xl px-4 py-3 fade-in ${style}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">🔊</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{EVENT_LABEL[event.eventType] || "Acoustic anomaly"}</p>
          <p className="text-xs mt-0.5">{event.message}</p>
          <p className="text-[11px] mt-1 opacity-80">
            Estimated confidence: {Math.round((event.confidence ?? 0.5) * 100)}% · ~{event.estimatedRadius ?? 150}m radius
          </p>
        </div>
        <button onClick={onDismiss} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
      </div>
    </div>
  );
}
