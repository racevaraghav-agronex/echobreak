import React, { useEffect, useRef, useState } from "react";
import { startVehicleAudioMonitor } from "../services/audioDetectionService";

export default function AudioSafetyMonitor({ onDetection, alert }) {
  const stopRef = useRef(null);
  const lastSpokenAtRef = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!enabled || !alert?.message || !("speechSynthesis" in window)) return;
    const now = Date.now();
    if (now - lastSpokenAtRef.current < 10000) return;
    lastSpokenAtRef.current = now;
    const utterance = new SpeechSynthesisUtterance(alert.message);
    utterance.rate = 1;
    utterance.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [alert, enabled]);

  const toggle = async () => {
    if (enabled) {
      stopRef.current?.();
      stopRef.current = null;
      setEnabled(false);
      setMessage("Microphone monitoring off");
      return;
    }
    setRequesting(true);
    setMessage("Preparing intelligent safety monitoring.");
    stopRef.current = await startVehicleAudioMonitor((event) => {
      setMessage(`Safety monitoring active · Audio signal confidence ${Math.round(event.confidence * 100)}%`);
      onDetection?.(event);
    }, (error) => setMessage(error.message));
    setRequesting(false);
    setEnabled(Boolean(stopRef.current));
  };

  return <div className="fixed bottom-24 left-3 z-20 flex max-w-[calc(100vw-24px)] flex-col gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
    {alert?.message && <div className={`rounded-lg border px-2.5 py-2 ${alert.level === "HIGH" || alert.level === "CRITICAL" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`} role="status">
      <strong>{alert.level || "Safety alert"}</strong>
      <div>{alert.message}</div>
      {alert.confidence != null && <span className="opacity-75">Confidence: {Math.round(alert.confidence * 100)}%</span>}
    </div>}
    <div className="flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={requesting} className={`rounded-lg px-2.5 py-1.5 font-semibold ${enabled ? "bg-eco-950 text-white" : "bg-slate-100 text-slate-700"}`}>
        {requesting ? "Activating safety monitoring." : enabled ? "Safety monitor on" : "Enable safety monitor"}
      </button>
      <span className="truncate text-slate-500">{message || "Ready · Local audio processing · No recording stored"}</span>
    </div>
  </div>;
}