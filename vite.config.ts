import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_API_SERVER = "http://192.168.1.157:5454";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = env.VITE_API_PROXY || env.VITE_API_SERVER || DEFAULT_API_SERVER;
  const pochtaProxy = env.VITE_POCHTA_API_PROXY || "http://127.0.0.1:8080";
  const eskdProxy = env.VITE_ESKD_API_PROXY || "http://127.0.0.1:8080";
  const onecProxy = env.VITE_ONEC_API_SERVER || "http://192.168.0.247:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      // В Docker на Windows события изменения файлов не доходят через bind
      // mount — без polling правки кода не подхватываются без перезапуска.
      watch: { usePolling: true, interval: 500 },
      proxy: {
        "/api/v1/documents/upload": {
          target: apiProxy,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0
        },
        "/api": {
          target: apiProxy,
          changeOrigin: true,
          ws: true,
          timeout: 600000,
          proxyTimeout: 600000
        },
        "/pochta-api": {
          target: pochtaProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/pochta-api/, ""),
          timeout: 120_000,
          proxyTimeout: 120_000
        },
        "/eskd-api": {
          target: eskdProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/eskd-api/, ""),
          timeout: 600_000,
          proxyTimeout: 600_000
        },
        "/onec-api": {
          target: onecProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/onec-api/, ""),
          timeout: 120000,
          proxyTimeout: 120000
        }
      }
    },
    preview: { host: "0.0.0.0", port: 5173 },
    build: { outDir: "dist", sourcemap: true }
  };
});
