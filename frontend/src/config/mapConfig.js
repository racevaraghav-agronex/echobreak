export const MAP_CONFIG = {
  style: import.meta.env.VITE_MAP_STYLE_URL || {
    version: 8,
    sources: { osm: { type: "raster", tiles: [import.meta.env.VITE_OSM_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
    layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
  },
  osmTileUrl: import.meta.env.VITE_OSM_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  geocodingProvider: import.meta.env.VITE_GEOCODING_PROVIDER || "backend",
  routingProvider: import.meta.env.VITE_ROUTING_PROVIDER || "backend",
  defaultCenter: [77.209, 28.6139],
  defaultZoom: 15,
};

export const MAP_LAYER_IDS = ["route", "search", "places", "traffic"];