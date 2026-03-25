import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeRiskResults",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./RiskResultPage": "./src/pages/RiskResultPage",
        "./PredictionHistoryPage": "./src/pages/PredictionHistoryPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
