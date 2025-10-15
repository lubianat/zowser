#!/usr/bin/env node
/**
 * Pre-cache thumbnails for NGFF .zarr images
 * Uses the same Thumbnail logic as in the Svelte app.
 */

import fs from "fs";
import path from "path";
import { createCanvas, ImageData } from "canvas";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import { generateThumbnail, loadMultiscales } from "./thumbnailGenerator.js";

// ────────────────────────────────────────────────────────────────
// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../public/thumbs");
const CSV_FILE = path.join(__dirname, "../public/samples/sample_zarrs_hydrated.csv");

// Ensure output folder
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ────────────────────────────────────────────────────────────────
// Load CSV
if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at: ${CSV_FILE}`);
    process.exit(1);
}
const csvLines = fs.readFileSync(CSV_FILE, "utf8").trim().split("\n");
const header = csvLines.shift().split(",");
const urlIndex = header.indexOf("url");
if (urlIndex === -1) {
    console.error("❌ CSV missing 'url' column header");
    process.exit(1);
}

console.log(`📂 Loaded ${csvLines.length} entries from CSV`);
console.log(`📸 Output directory: ${OUTPUT_DIR}`);
console.log("─────────────────────────────────────────────");

// Counters
let total = 0;
let skipped = 0;
let errors = 0;
let saved = 0;

// ────────────────────────────────────────────────────────────────
// Main loop
for (const [i, line] of csvLines.entries()) {
    const cols = line.split(",");
    const zarrUrl = cols[urlIndex]?.trim();
    if (!zarrUrl || !zarrUrl.endsWith(".zarr")) continue;
    total++;

    const outFile = path.join(OUTPUT_DIR, `${path.basename(zarrUrl)}.jpg`);

    if (fs.existsSync(outFile)) {
        console.log(`🟡 [${i + 1}/${csvLines.length}] Skip (exists): ${path.basename(outFile)}`);
        skipped++;
        continue;
    }

    console.log(`🔹 [${i + 1}/${csvLines.length}] Processing: ${zarrUrl}`);
    const t0 = performance.now();

    try {
        const [attrs, msUrl] = await loadMultiscales(zarrUrl);
        if (!attrs) {
            console.warn(`⚠️  No multiscales found for ${zarrUrl}`);
            errors++;
            continue;
        }

        const thumb = await generateThumbnail(msUrl, attrs);
        if (!thumb) {
            console.warn(`⚠️  Skipped (no data) for ${zarrUrl}`);
            errors++;
            continue;
        }

        const { rgb, width, height } = thumb;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.putImageData(new ImageData(rgb, width, height), 0, 0);

        fs.writeFileSync(outFile, canvas.toBuffer("image/jpeg", { quality: 0.85 }));
        const dt = (performance.now() - t0).toFixed(0);
        console.log(`✅  Saved ${path.basename(outFile)} (${width}×${height}) in ${dt} ms`);
        saved++;
    } catch (err) {
        console.warn(`❌ [${i + 1}] Error: ${zarrUrl}`);
        console.warn(`   ${err.message}`);
        errors++;
    }
}

console.log("\n─────────────────────────────────────────────");
console.log(`🏁 Done!`);
console.log(`   ✅ Saved: ${saved}`);
console.log(`   🟡 Skipped: ${skipped}`);
console.log(`   ❌ Errors: ${errors}`);
console.log(`   📊 Total attempted: ${total}`);
console.log("─────────────────────────────────────────────\n");
