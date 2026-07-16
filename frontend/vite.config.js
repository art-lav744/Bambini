import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MapLibre is a lazy-loaded map-route vendor chunk; the initial app bundle remains small.
  build: { chunkSizeWarningLimit: 1100 },
  server: {
    host: "0.0.0.0",
    // Dev/demo only: lets a temporary HTTPS tunnel hostname reach Vite.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/media": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
