import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "@brrock/vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  // load environment; Vite exposes VITE_* variables to client via import.meta.env
  const cwd =
    typeof (globalThis as any).process !== "undefined"
      ? (globalThis as any).process.cwd()
      : ".";
  const env = loadEnv(mode, cwd, "");
  const proxyTarget =
    env.VITE_PROXY_TARGET || env.VITE_API_BASE || "http://192.168.64.1:8080/";

  return {
    plugins: [react(), viteSingleFile()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          // Don't proxy requests for local module files (vite serves these at /api/*.ts)
          // If Vite requests a module under /api (like /api/client.ts), let Vite serve it.
          bypass: (req) => {
            const url = req?.url || "";
            if (
              url.endsWith(".ts") ||
              url.endsWith(".js") ||
              url.endsWith(".map")
            ) {
              return url;
            }
            return undefined;
          },
        },
      },
    },
  };
});
