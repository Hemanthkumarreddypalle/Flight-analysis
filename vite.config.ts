import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_FOUNDRY_PROXY_TARGET;

  return {
    plugins: [react()],
    server: {
      port: 8080,
      proxy:
        proxyTarget != null && proxyTarget !== ""
          ? {
              "/multipass": {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
              },
              "/api": {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
              },
              "/v2": {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
              },
              "/ontology-metadata": {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
              },
            }
          : undefined,
    },
  };
});
