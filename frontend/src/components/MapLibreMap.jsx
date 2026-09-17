import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "../config/mapConfig";
import { reverseGeocodeCoordinates } from "../services/geocodingService";

const emptyCollection = { type: "FeatureCollection", features: [] };
const VEHICLE_ICONS = { car: "🚗", bike: "🏍️", transit: "🚆", walking: "🚶", truck: "🚚", bus: "🚌", tempo: "🛻", hcv: "🚛" };

function pointFeature(point, properties = {}) {
  return { type: "Feature", geometry: { type: "Point", coordinates: [point.lng, point.lat] }, properties };
}

function pointCollection(points, properties) {
  return {
    type: "FeatureCollection",
    features: (points || []).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).map((point) => pointFeature(point, properties(point))),
  };
}

function removeMarkersAtCurrentLocation(points, currentPosition) {
  if (!currentPosition) return points || [];
  const latitude = Number(currentPosition.lat);
  const longitude = Number(currentPosition.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return points || [];
  return (points || []).filter((point) => Math.abs(Number(point.lat) - latitude) > 0.00025 || Math.abs(Number(point.lng) - longitude) > 0.00025);
}

const MapLibreMap = forwardRef(function MapLibreMap({
  center,
  zoom = MAP_CONFIG.defaultZoom,
  gpsPosition,
  vehicleMode = "car",
  showVehicleIcon = false,
  navigationActive = false,
  destination,
  searchResults = [],
  places = [],
  connectedUsers = [],
  untrackedTraffic = [],
  routes = [],
  geoJsonFeatures = [],
  audioVehicle,
  selectedRouteId,
  onSelectDestination,
  onSelectRoute,
  onMapClick,
  onLocationUpdate,
  onMapError,
}, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  useImperativeHandle(ref, () => ({
    fitBounds: (bounds, options) => mapRef.current?.fitBounds(bounds, options),
    setView: ([lat, lng], nextZoom) => mapRef.current?.flyTo({ center: [lng, lat], zoom: nextZoom }),
    flyTo: (options) => mapRef.current?.flyTo(options),
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    getZoom: () => mapRef.current?.getZoom() || zoom,
  }), [zoom]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({ container: containerRef.current, style: MAP_CONFIG.style, center: center || MAP_CONFIG.defaultCenter, zoom, attributionControl: false, cooperativeGestures: true });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    const handleLoad = () => {
      setLoading(false);
      map.addSource("search", { type: "geojson", data: emptyCollection });
      map.addSource("places", { type: "geojson", data: emptyCollection });
      map.addSource("traffic", { type: "geojson", data: emptyCollection, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
      map.addSource("route", { type: "geojson", data: emptyCollection });
      map.addSource("geojson", { type: "geojson", data: { type: "FeatureCollection", features: geoJsonFeatures } });
      map.addLayer({ id: "geojson-fill", type: "fill", source: "geojson", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#0f766e", "fill-opacity": 0.18 } });
      map.addLayer({ id: "geojson-line", type: "line", source: "geojson", filter: ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "Polygon"]], paint: { "line-color": "#0f766e", "line-width": 2 } });
      map.addLayer({ id: "geojson-points", type: "circle", source: "geojson", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": "#0f766e", "circle-radius": 6, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      map.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.8 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": ["case", ["==", ["get", "selected"], true], "#2563eb", "#94a3b8"], "line-width": ["case", ["==", ["get", "selected"], true], 6, 4], "line-opacity": 0.9 } });
      ["search", "places", "traffic"].forEach((id) => {
        if (id === "traffic") {
          map.addLayer({ id: `${id}-clusters`, type: "circle", source: id, filter: ["has", "point_count"], paint: { "circle-color": "#f97316", "circle-radius": ["step", ["get", "point_count"], 18, 20, 23, 100, 28], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        }
        if (id !== "places") {
          map.addLayer({ id: `${id}-points`, type: "circle", source: id, filter: ["!has", "point_count"], paint: { "circle-color": id === "traffic" ? "#dc2626" : "#2563eb", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        }
      });
      map.on("click", async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["search-points", "traffic-points", "route-line", "geojson-fill", "geojson-line", "geojson-points", "traffic-clusters"] });
        if (feature[0]?.properties?.cluster_id !== undefined) return;
        if (feature[0]?.properties?.routeId) onSelectRoute?.(feature[0].properties.routeId);
        else if (feature[0]?.properties?.place) {
          const place = JSON.parse(feature[0].properties.place);
          const popupContent = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = place.name || "Map location";
          popupContent.appendChild(title);
          if (place.address) {
            const address = document.createElement("div");
            address.textContent = place.address;
            popupContent.appendChild(address);
          }
          new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(popupContent).addTo(map);
          onSelectDestination?.(place);
        }
        else {
          const coordinates = { lat: event.lngLat.lat, lng: event.lngLat.lng };
          onMapClick?.(coordinates);
          try {
            const result = await reverseGeocodeCoordinates(coordinates.lat, coordinates.lng);
            onMapClick?.({ ...coordinates, address: result.address });
          } catch {
            onMapClick?.({ ...coordinates, address: "Address unavailable" });
          }
        }
      });
      map.on("click", ["traffic-clusters"], (event) => {
        const cluster = map.queryRenderedFeatures(event.point)[0];
        map.getSource(cluster.source).getClusterExpansionZoom(cluster.properties.cluster_id, (error, expansionZoom) => {
          if (!error) map.easeTo({ center: cluster.geometry.coordinates, zoom: expansionZoom });
        });
      });
      map.on("mouseenter", ["search-points", "traffic-points", "route-line", "traffic-clusters"], () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", ["search-points", "traffic-points", "route-line", "traffic-clusters"], () => { map.getCanvas().style.cursor = ""; });
    };
    map.on("load", handleLoad);
    map.on("error", (event) => { const message = event.error?.message || "Map tiles could not be loaded."; setMapError(message); onMapError?.(message); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const updateSources = () => {
      const updateSource = (id, data) => map.getSource(id)?.setData(data);
      updateSource("search", pointCollection(searchResults, (place) => ({ place: JSON.stringify(place) })));
      updateSource("places", pointCollection(removeMarkersAtCurrentLocation(places, gpsPosition), (place) => ({ place: JSON.stringify(place) })));
      updateSource("traffic", pointCollection(removeMarkersAtCurrentLocation([...connectedUsers, ...untrackedTraffic], gpsPosition), (point) => ({ place: JSON.stringify(point) })));
      updateSource("route", { type: "FeatureCollection", features: routes.filter((route) => route.geometry?.coordinates?.length).map((route) => ({ type: "Feature", geometry: route.geometry, properties: { routeId: route.routeId, selected: route.routeId === selectedRouteId } })) });
      updateSource("geojson", { type: "FeatureCollection", features: geoJsonFeatures });
    };
    if (map.isStyleLoaded()) updateSources();
    else map.once("load", updateSources);
    return () => map.off("load", updateSources);
  }, [searchResults, places, connectedUsers, untrackedTraffic, routes, selectedRouteId, geoJsonFeatures, gpsPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gpsPosition) return;
    if (!markerRefs.current.gps) {
      const element = document.createElement("div");
      element.className = "map-gps-marker";
      element.setAttribute("aria-label", "Current vehicle location");
      markerRefs.current.gps = new maplibregl.Marker({ element }).setPopup(new maplibregl.Popup().setText("You are here"));
    }
    const markerElement = markerRefs.current.gps.getElement();
    const isWalking = !showVehicleIcon || vehicleMode === "walking";
    markerElement.classList.toggle("map-gps-marker-walking", isWalking);
    markerElement.classList.toggle("map-gps-marker-vehicle", !isWalking);
    markerElement.textContent = isWalking ? "" : (VEHICLE_ICONS[vehicleMode] || VEHICLE_ICONS.car);
    const lat = Number(gpsPosition.lat);
    const lng = Number(gpsPosition.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    markerRefs.current.gps.setLngLat([lng, lat]).addTo(map);
    if (navigationActive) {
      map.easeTo({
        center: [lng, lat],
        bearing: Number.isFinite(Number(gpsPosition.heading)) ? Number(gpsPosition.heading) : map.getBearing(),
        zoom: Math.max(map.getZoom(), 16),
        duration: 700,
        essential: true,
      });
    }
    onLocationUpdate?.(gpsPosition);
  }, [gpsPosition, vehicleMode, showVehicleIcon, navigationActive]);

  useEffect(() => {
    const map = mapRef.current;
    const hasCoordinates = Number.isFinite(Number(destination?.lat)) && Number.isFinite(Number(destination?.lng));
    if (!map || !destination || !hasCoordinates) return;
    markerRefs.current.destination?.remove();
    const destinationPosition = [Number(destination.lng), Number(destination.lat)];
    markerRefs.current.destination = new maplibregl.Marker({ color: "#dc2626", draggable: true }).setLngLat(destinationPosition).setPopup(new maplibregl.Popup().setText(destination.name || "Destination")).addTo(map);
    markerRefs.current.destination.on("dragend", () => {
      const position = markerRefs.current.destination.getLngLat();
      onMapClick?.({ lat: position.lat, lng: position.lng, address: "Destination moved" });
    });
    map.flyTo({ center: destinationPosition, zoom: Math.max(map.getZoom(), 15), essential: true });
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !audioVehicle?.detected) {
      markerRefs.current.audioVehicle?.remove();
      return;
    }
    if (!markerRefs.current.audioVehicle) {
      const element = document.createElement("div");
      element.className = "map-audio-vehicle-marker";
      element.textContent = "🚗";
      markerRefs.current.audioVehicle = new maplibregl.Marker({ element }).setPopup(new maplibregl.Popup().setText("Nearby vehicle detected. Maintain a safe distance."));
    }
    const hasCoordinates = Number.isFinite(Number(audioVehicle.lat)) && Number.isFinite(Number(audioVehicle.lng));
    if (!hasCoordinates) return;
    const position = [Number(audioVehicle.lng), Number(audioVehicle.lat)];
    markerRefs.current.audioVehicle.setLngLat(position).addTo(map);
  }, [audioVehicle]);

  return <div className="absolute inset-0 maplibre-shell">
    <div ref={containerRef} className="absolute inset-0" aria-label="Interactive map" />
    {loading && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100/80 text-sm text-slate-600">Loading map…</div>}
    {mapError && <div className="absolute top-3 left-3 right-3 z-10 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{mapError}</div>}
  </div>;
});

export default MapLibreMap;