import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfeAuth",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App",
        "./LoginPage": "./src/pages/LoginPage",
        "./RegisterPage": "./src/pages/RegisterPage",
      },
      shared: ["react", "react-dom", "react-router-dom", "zustand"],
    }),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png"],
        manifest: {
          name: "PetCare AI",
          short_name: "PetCare AI",
          description: "Smart AI Health Assistant for Your Pet",
          theme_color: "#22c55e",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
              handler: "NetworkFirst",
              options: { cacheName: "firebase-auth-cache" },
            },
          ],
        },
        devOptions: { enabled: true },
      }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
