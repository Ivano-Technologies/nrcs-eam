import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";


// jsx-loc can throw during transform under concurrent Playwright loads (Windows).
const plugins = [
  react(),
  tailwindcss(),
  ...(process.env.DISABLE_VITE_JSX_LOC === "1" ? [] : [jsxLocPlugin()]),
  vitePluginManusRuntime(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.ico", "apple-touch-icon.png"],
    manifest: {
      name: "NRCS Enterprise Asset Management",
      short_name: "NRCS EAM",
      description: "Nigerian Red Cross Society Enterprise Asset Management System",
      theme_color: "#DC2626",
      background_color: "#0A1628",
      display: "standalone",
      orientation: "portrait-primary",
      scope: "/",
      start_url: "/app",
      icons: [
        { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
        { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
        { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
        { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
        { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
        { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      screenshots: [
        {
          src: "/icons/screenshot-desktop-1.png",
          sizes: "1280x720",
          type: "image/png",
          form_factor: "wide",
          label: "NRCS EAM Dashboard",
        },
        {
          src: "/icons/screenshot-desktop-2.png",
          sizes: "1280x720",
          type: "image/png",
          form_factor: "wide",
          label: "Asset Register",
        },
        {
          src: "/icons/screenshot-mobile-1.png",
          sizes: "540x720",
          type: "image/png",
          form_factor: "narrow",
          label: "NRCS EAM Mobile View",
        },
      ],
      categories: ["productivity", "utilities"],
      lang: "en",
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
        {
          urlPattern: /^https:\/\/nrcseam\.techivano\.com\/api\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "api-cache",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24,
            },
          },
        },
      ],
    },
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
