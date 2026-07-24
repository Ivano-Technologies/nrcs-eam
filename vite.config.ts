import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Resolve the real npm package name from a module id.
 * Uses the segment after the last `/node_modules/` so pnpm paths like
 * `.../.pnpm/recharts@x/node_modules/react-is/...` are attributed to `react-is`,
 * not wrongly to `recharts` via a naive `id.includes("recharts")` check.
 */
function packageNameFromId(id: string): string | null {
  const normalized = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + marker.length);
  if (!rest || rest.startsWith(".")) return null;
  if (rest.startsWith("@")) {
    const [scope, name] = rest.split("/");
    if (!scope || !name) return null;
    return `${scope}/${name}`;
  }
  return rest.split("/")[0] ?? null;
}

const VENDOR_CHUNKS: Record<string, string> = {
  xlsx: "xlsx",
  "framer-motion": "framerMotion",
  "date-fns": "dateFns",
  // recharts / @supabase/supabase-js / posthog-js: leave to Rollup defaults so
  // shared helpers are not glued into a vendor chunk that the entry then imports.
};

// jsx-loc can throw during transform under concurrent Playwright loads (Windows).
const plugins = [
  react(),
  tailwindcss(),
  ...(process.env.DISABLE_VITE_JSX_LOC === "1" ? [] : [jsxLocPlugin()]),
  {
    ...vitePluginManusRuntime(),
    /** Dev / AI tooling only — do not inject ~360KB inline runtime into production HTML */
    apply: "serve" as const,
  },
  VitePWA({
    registerType: "autoUpdate",
    injectRegister: "auto",
    scope: "/",
    base: "/",
    includeAssets: ["favicon.ico", "apple-touch-icon.png"],
    manifest: {
      id: "/",
      name: "NRCS Enterprise Asset Management",
      short_name: "NRCS EAM",
      description: "Nigerian Red Cross Society Enterprise Asset Management System",
      theme_color: "#C8102E",
      background_color: "#ffffff",
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
        { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
      // App shell only — lazy route chunks use runtimeCaching below.
      globPatterns: [
        "index.html",
        "manifest.webmanifest",
        "assets/index-*.js",
        "assets/*.css",
        "favicon.ico",
        "favicon-*.png",
        "apple-touch-icon.png",
        "icons/icon-*.png",
        "icons/*.svg",
        "**/*.{woff,woff2}",
      ],
      globIgnores: [
        "**/ComponentShowcase*",
        "**/mermaid*",
        "**/xlsx*",
        "**/screenshot-*",
        "**/node_modules/**",
      ],
      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      /** SPA client routes (/app/*) fall back to cached shell when offline. */
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//, /^\/login/, /^\/signup/, /^\/reset-password/],
      runtimeCaching: [
        {
          urlPattern: /\/assets\/.+\.js$/i,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "js-assets",
            expiration: {
              maxEntries: 64,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
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
          urlPattern: /\/api\//,
          handler: "NetworkOnly",
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
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const pkg = packageNameFromId(id);
          if (!pkg) return;
          if (pkg.startsWith("@radix-ui/")) return "radix";
          return VENDOR_CHUNKS[pkg];
        },
      },
    },
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
