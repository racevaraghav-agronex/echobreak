import React from "react";

export default function MapControls({ onRecenter, onZoomIn, onZoomOut, onReport }) {
  return (
    <div className="fixed right-3 bottom-28 sm:bottom-6 z-30 flex flex-col gap-2">
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="bg-white shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-lg font-bold text-eco-950"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="bg-white shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-lg font-bold text-eco-950"
      >
        −
      </button>
      <button
        onClick={onRecenter}
        aria-label="Recenter on my location"
        className="bg-white shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-lg"
      >
        🎯
      </button>
      <button
        onClick={onReport}
        aria-label="Report an issue"
        className="bg-white shadow-lg rounded-full w-11 h-11 flex items-center justify-center text-lg text-slate-800"
      >
        ⚠️
      </button>
    </div>
  );
}
