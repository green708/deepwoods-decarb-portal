import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        // Hostinger shared hosting — no persistent Node process.
        // build-static.mjs uses this output to capture the SSR shell.
        preset: "node-server",
        output: {
          // Override via NITRO_OUT env var if /tmp is unavailable (e.g. CI).
          dir: process.env.NITRO_OUT ?? "/tmp/ghg-output",
        },
      })
    );
  }

  // In dev mode, proxy /backend/ to the local PHP server (php -S localhost:8787)
  const server = command === "serve"
    ? {
        proxy: {
          "/backend": {
            target: "http://localhost:8787",
            changeOrigin: true,
          },
        },
      }
    : undefined;

  return { plugins, server };
});
