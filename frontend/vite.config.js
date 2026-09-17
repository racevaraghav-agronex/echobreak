import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  // Ensure legacy localhost:5000 environment variables do not get baked into the production bundle
  if (process.env.VITE_API_BASE_URL && process.env.VITE_API_BASE_URL.includes("localhost:5000")) {
    process.env.VITE_API_BASE_URL = "/api";
  }
  if (process.env.VITE_SOCKET_URL && process.env.VITE_SOCKET_URL.includes("localhost:5000")) {
    process.env.VITE_SOCKET_URL = "";
  }

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
    server: { port: 5173 },
  };
});
