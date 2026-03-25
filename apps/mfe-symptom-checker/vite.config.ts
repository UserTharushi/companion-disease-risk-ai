import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeSymptom",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./SymptomFormPage": "./src/pages/SymptomFormPage",
        "./ChatbotPage": "./src/pages/ChatbotPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
