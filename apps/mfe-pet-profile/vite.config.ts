import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfePetProfile",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./PetListPage": "./src/pages/PetListPage",
        "./PetDetailPage": "./src/pages/PetDetailPage",
        "./AddPetPage": "./src/pages/AddPetPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
