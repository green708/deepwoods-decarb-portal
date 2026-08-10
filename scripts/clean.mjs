// scripts/clean.mjs — removes old build artifacts before a fresh build
import { rm } from "node:fs/promises";

const targets = [".output", "dist-static", ".tanstack"];

console.log("Cleaning old build artifacts...");
await Promise.all(
  targets.map((dir) =>
    rm(dir, { recursive: true, force: true })
      .then(() => console.log(`  ✓ removed ${dir}`))
      .catch((e) => console.log(`  – ${dir} (${e.message})`))
  )
);
console.log("Clean done. Ready to build.\n");
