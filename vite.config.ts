import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "worker" } })],
  environments: {
    worker: { build: { sourcemap: true } },
  },

  input: {
    index: resolve(import.meta.dirname, "index.html"),
    404: resolve(import.meta.dirname, "404.html"),
  },

  build: {
    // This project doesn't use `modulepreload` links.
    modulePreload: { polyfill: false },
  },
});
