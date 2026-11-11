import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Segundo frontend (Cloudscape), solo para desarrollo local; no entra en la imagen Docker.
 * /api se reenvía al mismo backend que usa el frontend Angular (Spring en :2003): app y API
 * comparten origen, así que no hace falta tocar CORS y la cookie HttpOnly del refresh token
 * (Path=/api/auth) funciona igual que detrás de nginx.
 * Otro backend: BACKEND_URL=http://localhost:2013 npm run dev
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: process.env.BACKEND_URL ?? "http://localhost:2003" } },
  },
  build: {
    // El chunk "cloudscape" (librería de terceros, ~310 kB gzip) se cachea entre despliegues;
    // las páginas propias pesan ~10 kB y se descargan al visitarlas.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // Cloudscape, sus gráficos y React en chunks propios: cachean entre despliegues y las páginas
        // pesan poco. Los gráficos (con d3) solo se descargan en las páginas que los usan.
        manualChunks: (id) =>
          /node_modules\/(d3-|internmap|@cloudscape-design\/components\/(bar-chart|line-chart|area-chart|pie-chart|mixed-line-bar-chart|internal\/components\/(cartesian-chart|chart-)))/.test(id)
            ? "graficos"
            : id.includes("node_modules/@cloudscape-design")
              ? "cloudscape"
              : id.includes("node_modules/react")
                ? "react"
                : undefined,
      },
    },
  },
});
