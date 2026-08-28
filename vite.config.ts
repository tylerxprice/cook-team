import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: path.resolve(__dirname, "src/client"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "es2020",
    minify: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});
