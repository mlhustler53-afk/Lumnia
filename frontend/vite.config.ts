import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API requests to the backend during development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Increase timeout for streaming audio
        timeout: 120000,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
