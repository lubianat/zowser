import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import { existsSync, mkdirSync, copyFileSync } from "fs";
import { resolve as pathResolve, join as pathJoin } from "path";

// ---------------------------------------------------------------------------
// CloneIndexHtmlPlugin
// ---------------------------------------------------------------------------
// Ensures routes like /about/index.html exist so that GitHub Pages can serve
// subpages correctly when using HTML5 history mode.
function cloneIndexHtmlPlugin(routes = []) {
  const name = "CloneIndexHtmlPlugin";
  const outDir = "dist"; // Matches build.outDir (defaults to "dist")

  return {
    name,
    // Changed from `closeBundle` → `writeBundle` for reliability.
    writeBundle() {
      const src = pathJoin(outDir, "index.html");

      // Ensure we have routes to replicate
      const uniqueRoutes = Array.from(new Set(["about", ...routes]));

      // Abort early if index.html doesn't exist
      if (!existsSync(src)) {
        console.warn(`[${name}] Skipping: ${src} not found`);
        return;
      }

      for (const route of uniqueRoutes) {
        try {
          const dir = pathResolve(outDir, route);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

          const dst = pathJoin(dir, "index.html");
          copyFileSync(src, dst);
          console.log(`[${name}] Copied ${src} → ${dst}`);
        } catch (err) {
          console.error(`[${name}] Failed for route "${route}":`, err);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Vite Config
// ---------------------------------------------------------------------------
export default defineConfig(({ mode }) => {
  const config = {
    plugins: [svelte(), cloneIndexHtmlPlugin()],
    build: {
      outDir: "dist",
      emptyOutDir: true, // Clean previous builds
    },
  };

  // Use proper base path for GitHub Pages deployment
  if (process.env.GITHUB_REPOSITORY_OWNER) {
    config.base = `/zowser/`;
    console.log("[vite] Using GitHub Pages base path:", config.base);
  } else {
    config.base = "./";
  }

  return config;
});
