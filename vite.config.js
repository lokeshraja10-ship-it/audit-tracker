import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BASE_PATH = "/";

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
