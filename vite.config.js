import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5757,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["kokoro-js", "@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "data/words.json", "data/names.json"],
      manifest: {
        name: "Spell & Discover",
        short_name: "Spell & Discover",
        start_url: "./index.html",
        display: "standalone",
        background_color: "#eef3ff",
        theme_color: "#5b7fff",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cache the Kokoro TTS model + voice weights from the HF CDN so
            // the ~80MB download only ever happens once per device.
            urlPattern: ({ url }) =>
              url.hostname.endsWith("huggingface.co") ||
              url.hostname.endsWith("hf.co"),
            handler: "CacheFirst",
            options: {
              cacheName: "kokoro-tts-model",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
