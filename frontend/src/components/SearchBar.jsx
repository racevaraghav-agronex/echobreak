import React, { useEffect, useRef, useState } from "react";
import { fetchOsmFeatures, searchDestinations } from "../services/routingService";

const RECENTS_KEY = "echobreak_recent_searches";

export default function SearchBar({ origin, onSelectDestination, onResults }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const debounceRef = useRef(null);

  const recents = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");

  const loadNearbyResults = async () => {
    if (!origin?.lat || !origin?.lng || nearbyResults.length > 0) return;
    setLoadingNearby(true);
    try {
      const places = await fetchOsmFeatures(origin, 1500);
      setNearbyResults(places.slice(0, 8));
    } catch (err) {
      setNearbyResults([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      onResults?.([]);
      return;
    }
    if (query.trim().length < 2) {
      setResults([]);
      onResults?.([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchDestinations(query, origin);
        setResults(data);
        onResults?.(data);
      } catch (err) {
        setError("Search unavailable right now. Please try again.");
        setResults([]);
        onResults?.([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, origin?.lat, origin?.lng, onResults]);

  const handleSelect = (place) => {
    const updated = [place, ...recents.filter((r) => r.address !== place.address)].slice(0, 5);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    setQuery("");
    setResults([]);
    setNearbyResults([]);
    setOpen(false);
    onSelectDestination(place);
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-slate-200 px-4 py-3">
        <span className="text-eco-800 text-lg">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
            loadNearbyResults();
          }}
          placeholder="Search destination, place, or address"
          aria-label="Search destination"
          className="flex-1 outline-none text-sm text-slate-800 placeholder-slate-400 bg-transparent"
        />
        {loading && <span className="text-xs text-slate-400">Searching…</span>}
      </div>

      {open && (query.trim() || recents.length > 0 || nearbyResults.length > 0 || loadingNearby) && (
        <div className="absolute mt-2 w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden fade-in z-20 max-h-80 overflow-y-auto">
          {error && <div className="px-4 py-3 text-xs text-red-600">{error}</div>}

          {!query.trim() && loadingNearby && (
            <div className="px-4 py-3 text-xs text-slate-400">Finding nearby places.</div>
          )}

          {!query.trim() && nearbyResults.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                Nearby
              </p>
              {nearbyResults.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelect(place)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex flex-col"
                >
                  <span className="text-sm font-medium text-slate-800">{place.name}</span>
                  <span className="text-xs text-slate-400 truncate">
                    {place.category} · {place.distanceMeters >= 1000 ? `${(place.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(place.distanceMeters)} m`} away
                  </span>
                </button>
              ))}
            </div>
          )}

          {!query.trim() && recents.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                Recent
              </p>
              {recents.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex flex-col"
                >
                  <span className="text-sm font-medium text-slate-800">{r.name}</span>
                  <span className="text-xs text-slate-400 truncate">{r.address}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && !error && (
            <div className="px-4 py-4 text-sm text-slate-400 text-center">No results found.</div>
          )}

          {results.map((place, i) => (
            <button
              key={i}
              onClick={() => handleSelect(place)}
              onKeyDown={(e) => e.key === "Enter" && handleSelect(place)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex flex-col border-t border-slate-100 first:border-t-0"
            >
              <span className="text-sm font-medium text-slate-800">{place.name}</span>
              <span className="text-xs text-slate-400 truncate">{place.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
