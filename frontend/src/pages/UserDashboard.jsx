import React, { useCallback, useEffect, useRef, useState } from "react";

import SearchBar from "../components/SearchBar";
import DestinationPanel from "../components/DestinationPanel";
import DirectionsPanel from "../components/DirectionsPanel";
import NavigationHUD from "../components/NavigationHUD";
import MapControls from "../components/MapControls";
import ReportPanel from "../components/ReportPanel";
import AcousticWarning from "../components/AcousticWarning";
import AudioSafetyMonitor from "../components/AudioSafetyMonitor";
import MapLibreMap from "../components/MapLibreMap";
import MapErrorBoundary from "../components/MapErrorBoundary";

import api from "../utils/api";
import { fetchOsmFeatures, fetchRoutes } from "../services/routingService";
import { watchPosition, getCurrentPosition } from "../services/locationService";
import { distanceToRoute, isOffRoute, findNextStep } from "../services/mapService";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";

export default function UserDashboard({ user, onLogout }) {
  // Navigation state machine:
  // IDLE -> SEARCHING -> DESTINATION_SELECTED -> ROUTE_PREVIEW -> ROUTE_SELECTED -> NAVIGATING -> REROUTING -> ARRIVED -> EXITED
  const [navState, setNavState] = useState("IDLE");

  const [origin, setOrigin] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [destination, setDestination] = useState(null);
  const [vehicleMode, setVehicleMode] = useState(user?.vehicleMode || "car");
  const [vehicleSelected, setVehicleSelected] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [osmFeatures, setOsmFeatures] = useState([]);

  const [liveGps, setLiveGps] = useState(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [acousticEvent, setAcousticEvent] = useState(null);
  const [untrackedTraffic, setUntrackedTraffic] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [pacingAdvice, setPacingAdvice] = useState(null);
  const [audioVehicle, setAudioVehicle] = useState(null);

  const lastSpokenStepRef = useRef(null);
  const lastRerouteAtRef = useRef(0);
  const mapRef = useRef(null);

  const selectedRoute = routes.find((r) => r.routeId === selectedRouteId);

  // ---- Initial location + socket setup ----
  useEffect(() => {
    getCurrentPosition()
      .then((pos) => setOrigin(pos))
      .catch((err) => setGpsError(err.message));

    const stopWatch = watchPosition(
      (pos) => setLiveGps(pos),
      (err) => setGpsError(err.message)
    );

    const socket = connectSocket();
    socket.on("acoustic:event", (payload) => {
      setAcousticEvent({
        eventType: payload.eventType,
        level: payload.riskScore >= 80 ? "CRITICAL" : payload.riskScore >= 55 ? "HIGH" : payload.riskScore >= 30 ? "MEDIUM" : "LOW",
        message: "Elevated collision-risk signal detected nearby.",
        confidence: payload.confidence,
      });
    });
    socket.on("pacing:update", (payload) => setPacingAdvice(payload));
    socket.on("safety:event", (event) => setAcousticEvent({ eventType: event.type, level: event.severity, message: event.message, confidence: event.confidence, estimatedRadius: event.distanceMeters }));
    socket.on("vehicle:update", (vehicle) => {
      setConnectedUsers((current) => {
        const next = current.filter((item) => item.id !== vehicle.vehicleSessionId);
        return [...next, { id: vehicle.vehicleSessionId, vehicleMode: "unknown", lat: vehicle.lat, lng: vehicle.lng, speed: vehicle.speed, heading: vehicle.heading, anonymous: true }];
      });
    });
    socket.on("connect_error", () => setGpsError("Live safety connection unavailable. Reconnecting…"));
    socket.on("connect", () => setGpsError((current) => current.startsWith("Live safety") ? "" : current));
    const heartbeat = window.setInterval(() => socket.connected && socket.emit("vehicle:heartbeat"), 15000);

    return () => {
      stopWatch();
      socket.off("acoustic:event");
      socket.off("pacing:update");
      socket.off("safety:event");
      socket.off("vehicle:update");
      socket.off("connect_error");
      socket.off("connect");
      window.clearInterval(heartbeat);
      disconnectSocket();
    };
  }, []);

  // Load named OSM features near the current position for map context.
  useEffect(() => {
    const point = origin || liveGps;
    if (!point) return;

    fetchOsmFeatures(point)
      .then(setOsmFeatures)
      .catch(() => setOsmFeatures([]));
    // The public Overpass service is rate-limited; do not query on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng]);

  // Broadcast own location + poll nearby untracked/connected traffic while we have a position
  useEffect(() => {
    const point = liveGps || origin;
    if (!point) return;

    const socket = getSocket();
    if (socket.connected) socket.emit("user:location", { lat: point.lat, lng: point.lng, heading: point.heading, speed: point.speed, acceleration: point.acceleration, routeId: selectedRouteId, hasDestination: Boolean(destination) });

    const poll = async () => {
      try {
        const { data } = await api.get("/traffic/nearby", { params: { lat: point.lat, lng: point.lng } });
        setUntrackedTraffic(data.untrackedTraffic || []);
        setConnectedUsers((data.connectedUsers || []).filter((connectedUser) => String(connectedUser.id) !== String(user?._id)));
      } catch (err) {
        // Non-fatal: nearby-traffic layer just stays empty until the next successful poll
      }
    };
    poll();
    const interval = setInterval(poll, 12000);
    return () => clearInterval(interval);
  }, [liveGps?.lat, liveGps?.lng, origin?.lat, origin?.lng, user?._id]);

  // ---- Destination selection ----
  const handleSelectDestination = (place) => {
    setDestination(place);
    setVehicleSelected(false);
    setRoutes([]);
    setSelectedRouteId(null);
    setRouteError("");
    setNavState("DESTINATION_SELECTED");
  };

  const handleGetDirections = useCallback(async () => {
    if (!origin || !destination) return;
    setLoadingRoutes(true);
    setRouteError("");
    try {
      const result = await fetchRoutes({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleMode,
      });
      setRoutes(result);
      setSelectedRouteId(result[0]?.routeId || null);
      setNavState("ROUTE_PREVIEW");
    } catch (err) {
      setRouteError(err.response?.data?.message || "Could not find a route. Please try a different destination.");
    } finally {
      setLoadingRoutes(false);
    }
  }, [origin, destination, vehicleMode]);

  const handleStartNavigation = () => {
    if (!selectedRoute) return;
    setProgressIndex(0);
    setNavState("NAVIGATING");
  };

  const handleSelectRoute = useCallback((routeId) => {
    setSelectedRouteId(routeId);
    const route = routes.find((item) => item.routeId === routeId);
    if (route?.geometry?.coordinates?.length && mapRef.current) {
      const lngs = route.geometry.coordinates.map(([lng]) => lng);
      const lats = route.geometry.coordinates.map(([, lat]) => lat);
      const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 16 });
    }
  }, [routes]);

  const handleRecenter = useCallback(() => {
    const point = liveGps || origin;
    if (point && mapRef.current) {
      mapRef.current.setView([point.lat, point.lng], Math.max(mapRef.current.getZoom(), 16));
    }
  }, [liveGps, origin]);

  const handleExitNavigation = () => {
    setNavState("EXITED");
    setDestination(null);
    setVehicleSelected(false);
    setRoutes([]);
    setSelectedRouteId(null);
    setTimeout(() => setNavState("IDLE"), 50);
  };

  // ---- Live navigation loop: off-route detection, rerouting, voice, pacing ----
  useEffect(() => {
    if (navState !== "NAVIGATING" || !selectedRoute || !liveGps) return;

    const coords = selectedRoute.geometry.coordinates;
    const point = [liveGps.lng, liveGps.lat];
    const { index } = distanceToRoute(point, coords);
    setProgressIndex(index);

    // Arrival check: close to final coordinate
    const lastCoord = coords[coords.length - 1];
    const distToEnd = distanceToRoute(point, [lastCoord]).distance;
    if (distToEnd < 30) {
      setNavState("ARRIVED");
      return;
    }

    // Off-route detection -> reroute (throttled to avoid spamming the routing API)
    const now = Date.now();
    if (isOffRoute(point, coords) && now - lastRerouteAtRef.current > 15000) {
      lastRerouteAtRef.current = now;
      setRerouting(true);
      setNavState("REROUTING");
      fetchRoutes({
        originLat: liveGps.lat,
        originLng: liveGps.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleMode,
      })
        .then((newRoutes) => {
          setRoutes(newRoutes);
          setSelectedRouteId(newRoutes[0]?.routeId || null);
          setNavState("NAVIGATING");
        })
        .catch(() => setNavState("NAVIGATING"))
        .finally(() => setRerouting(false));
      return;
    }

    // Speed pacing advisory (server-computed from live congestion prediction)
    api
      .post("/traffic/pacing", { lat: liveGps.lat, lng: liveGps.lng, currentSpeed: liveGps.speed })
      .then(({ data }) => setPacingAdvice(data))
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveGps, navState, selectedRoute]);

  // ---- Voice guidance ----
  const nextStep = selectedRoute
    ? findNextStep(selectedRoute.legs?.[0]?.steps || [], progressIndex, selectedRoute.geometry.coordinates)
    : null;

  useEffect(() => {
    if (navState !== "NAVIGATING" || !voiceOn || !nextStep || !("speechSynthesis" in window)) return;
    const key = `${nextStep.instruction}-${nextStep.roadName}-${Math.round((nextStep.distanceMeters || 0) / 50)}`;
    if (lastSpokenStepRef.current === key) return;
    lastSpokenStepRef.current = key;

    const phrase = describeInstruction(nextStep);
    const utter = new SpeechSynthesisUtterance(phrase);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [nextStep, voiceOn, navState]);

  function describeInstruction(step) {
    const dist = step.distanceMeters >= 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} kilometers` : `${Math.round(step.distanceMeters)} meters`;
    const map = {
      turn: `In ${dist}, turn ${step.modifier || ""}`.trim(),
      "new name": `Continue for ${dist}`,
      depart: "Starting navigation",
      arrive: "You have arrived at your destination",
      merge: `In ${dist}, merge ${step.modifier || ""}`.trim(),
      "on ramp": `In ${dist}, take the ramp`,
      "off ramp": `In ${dist}, take the exit`,
      fork: `In ${dist}, keep ${step.modifier || "straight"}`,
      roundabout: `In ${dist}, enter the roundabout`,
      continue: `Continue straight for ${dist}`,
      "end of road": `In ${dist}, turn ${step.modifier || ""} at the end of the road`.trim(),
      uturn: `In ${dist}, make a U-turn`,
    };
    return map[step.instruction] || `Continue for ${dist}`;
  }

  const displayPosition = liveGps || origin;
  const remainingCoords = selectedRoute ? selectedRoute.geometry.coordinates.slice(progressIndex) : [];
  const distanceRemaining = remainingCoords.length > 1
    ? remainingCoords.reduce((sum, c, i) => (i === 0 ? 0 : sum + distanceToRoute(remainingCoords[i - 1], [c]).distance), 0)
    : 0;

  return (
    <div className="h-screen w-screen relative bg-slate-100 overflow-hidden">
      <MapErrorBoundary>
        <MapLibreMap
          ref={mapRef}
          center={displayPosition ? [displayPosition.lng, displayPosition.lat] : [77.209, 28.6139]}
          gpsPosition={displayPosition}
          vehicleMode={vehicleMode}
          showVehicleIcon={vehicleSelected}
          navigationActive={navState === "NAVIGATING"}
          destination={destination}
          searchResults={searchResults}
          places={osmFeatures}
          connectedUsers={connectedUsers}
          untrackedTraffic={untrackedTraffic}
          routes={routes}
          selectedRouteId={selectedRouteId}
          audioVehicle={audioVehicle}
          onSelectDestination={handleSelectDestination}
          onSelectRoute={handleSelectRoute}
          onMapClick={(point) => setGpsError(point.address ? `Selected: ${point.address}` : `Selected ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`)}
        />
      </MapErrorBoundary>
      <AudioSafetyMonitor alert={acousticEvent} onDetection={async (event) => {
        setAcousticEvent({ eventType: event.type, level: "MEDIUM", message: event.message, confidence: event.confidence });
        setAudioVehicle({ ...event, lat: displayPosition?.lat, lng: displayPosition?.lng });
        getSocket().emit("audio:detection", { ...event, lat: displayPosition?.lat, lng: displayPosition?.lng });
        if (displayPosition) {
          try { await api.post("/traffic/acoustic-event", { eventType: "proximity_echo_anomaly", confidence: event.confidence, severity: "medium", lat: displayPosition.lat, lng: displayPosition.lng, source: "estimated" }); } catch { /* local warning remains active */ }
        }
      }} />

      {/* Top bar: header + search (hidden during navigation) */}
      {navState !== "NAVIGATING" && navState !== "REROUTING" && (
        <div className="absolute inset-x-0 top-0 z-20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 bg-eco-950 text-white rounded-2xl pl-2.5 pr-4 py-1.5 shadow-lg">
              <span className="header-logo-crop" aria-hidden="true">
                <img src="/favicon.png" alt="" className="header-logo-image" />
              </span>
              <div className="flex flex-col text-left">
                <span className="font-bold text-sm leading-tight text-white">Echobreak</span>
                <span className="text-[11px] text-eco-400 font-medium leading-tight">{user?.name || "Driver"}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="bg-white shadow-lg rounded-full px-4 py-2 text-xs font-semibold text-eco-950"
            >
              Log out
            </button>
          </div>

          {gpsError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">{gpsError}</div>
          )}

          <SearchBar origin={displayPosition} onSelectDestination={handleSelectDestination} onResults={setSearchResults} />
        </div>
      )}

      {acousticEvent && <AcousticWarning event={acousticEvent} onDismiss={() => setAcousticEvent(null)} />}

      {navState === "NAVIGATING" && (
        <NavigationHUD
          nextStep={nextStep}
          distanceRemaining={distanceRemaining}
          durationRemaining={selectedRoute?.durationSeconds}
          currentSpeedKph={(liveGps?.speed || 0) * 3.6}
          voiceOn={voiceOn}
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onRecenter={handleRecenter}
          onExit={handleExitNavigation}
          rerouting={rerouting}
          pacingAdvice={pacingAdvice}
        />
      )}

      {navState === "ARRIVED" && (
        <div className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm">
            <p className="text-4xl mb-2">🏁</p>
            <h3 className="font-bold text-xl text-eco-950">You've arrived</h3>
            <p className="text-sm text-slate-500 mt-1">{destination?.name}</p>
            <button onClick={handleExitNavigation} className="mt-5 w-full bg-eco-950 text-white font-semibold py-3 rounded-xl">
              Done
            </button>
          </div>
        </div>
      )}

      {navState === "DESTINATION_SELECTED" && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3">
          <DestinationPanel
            destination={destination}
            vehicleMode={vehicleMode}
            onSelectVehicle={(mode) => {
              setVehicleMode(mode);
              setVehicleSelected(true);
            }}
            bestRoute={routes[0]}
            loadingRoutes={loadingRoutes}
            routeError={routeError}
            onGetDirections={handleGetDirections}
            onClose={() => {
              setDestination(null);
              setVehicleSelected(false);
              setNavState("IDLE");
            }}
          />
        </div>
      )}

      {navState === "ROUTE_PREVIEW" && routes.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3">
          <DirectionsPanel
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={handleSelectRoute}
            onStart={handleStartNavigation}
            onClose={() => setNavState("DESTINATION_SELECTED")}
          />
        </div>
      )}

      {navState !== "NAVIGATING" && navState !== "REROUTING" && (
        <MapControls
          onRecenter={handleRecenter}
          onZoomIn={() => mapRef.current?.zoomIn?.()}
          onZoomOut={() => mapRef.current?.zoomOut?.()}
          onReport={() => setShowReport(true)}
        />
      )}

      {showReport && (
        <ReportPanel location={liveGps || origin} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
