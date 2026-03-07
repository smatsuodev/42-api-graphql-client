import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "dashboard",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/graphql": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
