import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vercelApiPlugin } from "./dev/vercelApiPlugin";

export default defineConfig({
  plugins: [vercelApiPlugin(), react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
