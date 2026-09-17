import React from "react";

const VEHICLES = [
  { id: "car", label: "Car", emoji: "🚗" },
  { id: "bike", label: "Bike", emoji: "🏍️" },
  { id: "transit", label: "Transit", emoji: "🚆" },
  { id: "walking", label: "Walk", emoji: "🚶" },
  { id: "truck", label: "Truck", emoji: "🚚" },
  { id: "bus", label: "Bus", emoji: "🚌" },
  { id: "tempo", label: "Tempo", emoji: "🛻" },
  { id: "hcv", label: "Heavy Vehicle", emoji: "🚛" },
];

export default function VehicleSelector({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {VEHICLES.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          aria-pressed={selected === v.id}
          className={`flex flex-col items-center justify-center gap-1 min-w-[64px] rounded-2xl px-3 py-2 border transition ${
            selected === v.id
              ? "bg-eco-950 border-eco-950 text-white shadow-md"
              : "bg-white border-slate-200 text-slate-700 hover:border-eco-600"
          }`}
        >
          <span className="text-xl">{v.emoji}</span>
          <span className="text-[11px] font-medium">{v.label}</span>
        </button>
      ))}
    </div>
  );
}
