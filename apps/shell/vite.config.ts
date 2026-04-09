import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "shell",
      remotes: {
        mfeAuth:        "http://localhost:3001/assets/remoteEntry.js",
        mfePetProfile:  "http://localhost:3002/assets/remoteEntry.js",
        mfeSymptom:     "http://localhost:3003/assets/remoteEntry.js",
        mfeRiskResults: "http://localhost:3004/assets/remoteEntry.js",
        mfeVetDiscover: "http://localhost:3005/assets/remoteEntry.js",
        mfeVaccination: "http://localhost:3006/assets/remoteEntry.js",
        mfeAdmin:       "http://localhost:3007/assets/remoteEntry.js",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Companion Disease Risk AI",
        short_name: "CompanionAI",
        description: "Agentic AI decision support for companion animal health",
        theme_color: "#0ea5e9",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false
  }
});
