import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_API_SERVER = "http://192.168.1.157:5454";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = env.VITE_API_PROXY || env.VITE_API_SERVER || DEFAULT_API_SERVER;

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
      proxy: {
        "/api": {
          target: apiProxy,
          changeOrigin: true
        }
      }
    },
    preview: { host: "0.0.0.0", port: 5173 },
    build: { outDir: "dist", sourcemap: true }
  };
});
