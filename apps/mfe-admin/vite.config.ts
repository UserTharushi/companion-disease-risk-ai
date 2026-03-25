import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeAdmin",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./DashboardPage": "./src/pages/DashboardPage",
        "./ClinicManagementPage": "./src/pages/ClinicManagementPage",
        "./SurgeonManagementPage": "./src/pages/SurgeonManagementPage",
        "./DiseaseVaccineDBPage": "./src/pages/DiseaseVaccineDBPage",
        "./AnalyticsPage": "./src/pages/AnalyticsPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
