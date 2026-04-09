import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeVaccination",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./VaccinationDashboard": "./src/pages/VaccinationDashboard",
        "./AddVaccinationPage": "./src/pages/AddVaccinationPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
