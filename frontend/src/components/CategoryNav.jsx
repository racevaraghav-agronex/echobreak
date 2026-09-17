import React, { useState } from "react";
import { fetchNearbyCategory } from "../services/routingService";

const CATEGORIES = [
  { key: "petrol", label: "Petrol", emoji: "⛽" },
  { key: "hospital", label: "Hospital", emoji: "🏥" },
  { key: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { key: "hotels", label: "Hotels", emoji: "🏨" },
  { key: "parking", label: "Parking", emoji: "🅿️" },
];

export default function CategoryNav({ origin, onResults, onSelectPlace }) {
  const [activeCategory, setActiveCategory] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const formatDistance = (distanceMeters) => {
    if (!Number.isFinite(distanceMeters)) return "Nearby";
    return distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km away`
      : `${Math.round(distanceMeters)} m away`;
  };

  const handleClick = async (cat) => {
    setActiveCategory(cat.label);
    setMessage("");
    try {
      if (!Number.isFinite(Number(origin?.lat)) || !Number.isFinite(Number(origin?.lng))) {
        throw new Error("Waiting for your location...");
      }
      const results = (await fetchNearbyCategory(cat.key, {
        lat: Number(origin.lat),
        lng: Number(origin.lng),
      })) || [];
      onResults(results, cat.label);
      setResults(results);
      setSelectedCategory(cat.label);
      setMessage(results.length ? `${results.length} found nearby` : `No ${cat.label.toLowerCase()} found nearby.`);
    } catch (err) {
      setMessage(err.message || `Could not load ${cat.label.toLowerCase()} nearby.`);
      setResults([]);
      setSelectedCategory(cat.label);
      onResults([], cat.label);
    } finally {
      setActiveCategory("");
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleClick(cat)}
            disabled={Boolean(activeCategory)}
            className={`flex items-center gap-1.5 whitespace-nowrap bg-white border shadow-sm rounded-full px-4 py-2 text-sm font-medium text-eco-950 transition ${selectedCategory === cat.label ? "border-eco-700 ring-2 ring-eco-200" : "border-slate-200 hover:bg-eco-950 hover:text-white"
              }`}
          >
            <span>{cat.emoji}</span>
            {activeCategory === cat.label ? "Loading..." : cat.label}
          </button>
        ))}
        {message && <span className="self-center text-xs text-slate-600 whitespace-nowrap">{message}</span>}
      </div>

      {selectedCategory && results.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-eco-950">Nearby {selectedCategory}</p>
            <button type="button" onClick={() => setSelectedCategory("")} className="text-slate-400 text-lg" aria-label="Close nearby places">×</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map((place) => (
              <button
                key={place.id || `${place.lat}-${place.lng}`}
                type="button"
                onClick={() => onSelectPlace(place)}
                className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-eco-50 transition"
              >
                <span className="block text-sm font-semibold text-slate-800">{place.name}</span>
                <span className="block text-xs text-slate-500 mt-1">{place.address || place.category || "OpenStreetMap place"}</span>
                <span className="block text-xs font-semibold text-eco-800 mt-1">{formatDistance(place.distanceMeters)} · Create route</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
