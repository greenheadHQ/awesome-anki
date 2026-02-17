import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["dev.greenhead.dev"],
    proxy: {
      // /api 요청을 백엔드 서버로 프록시
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
