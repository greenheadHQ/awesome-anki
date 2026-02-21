import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";
  const apiKey = env.ANKI_SPLITTER_API_KEY;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        // /api 요청을 백엔드 서버로 프록시
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          // 브라우저 번들에는 비밀값을 넣지 않고 개발 프록시에서만 헤더를 주입한다.
          ...(apiKey ? { headers: { "X-API-Key": apiKey } } : {}),
        },
      },
    },
  };
});
