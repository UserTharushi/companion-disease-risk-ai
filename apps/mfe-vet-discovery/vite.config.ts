import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeVetDiscover",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./ClinicMapPage": "./src/pages/ClinicMapPage",
        "./ClinicDetailPage": "./src/pages/ClinicDetailPage",
        "./BookingPage": "./src/pages/BookingPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
