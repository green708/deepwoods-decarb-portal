// Assembles a plain static bundle deployable to Hostinger shared hosting
// (Business plan — Apache/PHP, no persistent Node process).
//
// Why this exists instead of `nitro --preset static`: this app has no real
// server logic (auth + submissions are localStorage-only), so we don't need
// per-route SSR content — we need one correctly-rendered HTML shell plus the
// client JS/CSS bundle, with TanStack Router taking over all routing in the
// browser. Nitro v3's built-in static-preset crawler is still beta and 404s
// on internal prerender requests in this TanStack Start setup, so instead we:
//   1. build with the stable `node-server` Nitro preset (set in vite.config.ts)
//   2. run that server locally just long enough to fetch "/" ourselves
//   3. save that HTML as the single shell for every route
//   4. copy the static asset output alongside it
//   5. write an .htaccess SPA-fallback rule so Apache serves that shell for
//      any path that isn't a real file (e.g. /dashboard, /workstreams)
//
// Usage: node scripts/build-static.mjs   (run after `npm run build`)

import { spawn } from "node:child_process";
import { cp, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
// nitro output dir is /tmp/ghg-output (set in vite.config.ts to avoid EPERM on Windows mount)
const nitroOut = process.env.NITRO_OUT || "/tmp/ghg-output";
const serverEntry = path.join(nitroOut, "server/index.mjs");
const publicDir = path.join(nitroOut, "public");
const outDir = path.join(root, "dist-static");
const port = 8917;

async function main() {
  if (!existsSync(serverEntry)) {
    console.error(`Missing ${serverEntry} — run \`npm run build\` first.`);
    process.exit(1);
  }

  console.log("Starting local server to capture the SSR shell...");
  const child = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit",
  });

  try {
    await waitForServer(`http://localhost:${port}/`, 15000);
    const res = await fetch(`http://localhost:${port}/`);
    if (!res.ok) throw new Error(`Root fetch failed: HTTP ${res.status}`);
    const html = await res.text();

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(publicDir, outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html, "utf8");
    await writeFile(path.join(outDir, ".htaccess"), HTACCESS, "utf8");

    // Copy backend/ into dist-static/backend/ so the whole dist-static folder
    // is the complete Hostinger deployment (frontend + PHP API in one place).
    const backendSrc = path.join(root, "backend");
    await cp(backendSrc, path.join(outDir, "backend"), { recursive: true });
    console.log("  ✓ backend/ copied into dist-static/");

    // Copy ghg-proxy.php to dist-static root so it lands at public_html/ghg-proxy.php
    const proxySrc = path.join(root, "ghg-proxy.php");
    if (existsSync(proxySrc)) {
      await cp(proxySrc, path.join(outDir, "ghg-proxy.php"));
      console.log("  ✓ ghg-proxy.php copied into dist-static/");
    }

    console.log(`\nAll done — dist-static/ contains everything for Hostinger.`);
    console.log("Upload the entire contents of dist-static/ to public_html/.");
  } finally {
    child.kill();
  }
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Server did not start in time");
}

const HTACCESS = `# SPA fallback forclient-side routing (TanStack Router).
# Serve real files/assets directly; everything else falls back to index.html.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  RewriteRule ^ index.html [L]
</IfModule>
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

