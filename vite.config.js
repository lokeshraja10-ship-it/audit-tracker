import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set this to "/your-repo-name/" before deploying to GitHub Pages.
const BASE_PATH = "/audit-tracker/";

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
});
