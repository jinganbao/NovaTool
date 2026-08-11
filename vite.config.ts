import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 1421,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@codemirror") || id.includes("/codemirror/")) return "vendor-codemirror";
          if (id.includes("naive-ui")) return "vendor-naive-ui";
          if (id.includes("lucide-vue-next")) return "vendor-icons";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          if (id.includes("/vue/") || id.includes("@vue")) return "vendor-vue";
        },
      },
    },
  },
});
