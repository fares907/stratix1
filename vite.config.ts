import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// The hero headline and Arabic body text are the first things painted, but the
// browser only discovers their fonts after downloading and parsing the CSS.
// Preloading the two faces from the HTML starts both downloads immediately, so
// the first paint uses the real fonts instead of swapping in a moment later.
const CRITICAL_FONTS = [/unbounded-latin-wght-normal-.*\.woff2$/, /ibm-plex-sans-arabic-arabic-400-normal-.*\.woff2$/];

function preloadCriticalFonts(): Plugin {
  return {
    name: "preload-critical-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter(file => CRITICAL_FONTS.some(pattern => pattern.test(file)));
        return files.map(file => ({
          tag: "link",
          attrs: { rel: "preload", href: `/${file}`, as: "font", type: "font/woff2", crossorigin: "" },
          injectTo: "head" as const,
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadCriticalFonts()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // No custom manualChunks: a hand-written vendor/framework split here was
    // producing a chunk evaluation-order hazard (some non-React-named vendor
    // code ended up executing before the "framework" chunk that defines
    // React, so `React.createContext` read as undefined and the app never
    // mounted in production — #root stayed empty with no console error).
    // Rollup's automatic splitting respects the real dependency graph.
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
