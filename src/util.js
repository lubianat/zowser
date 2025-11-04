// src/util.js
// Frontend utilities (logos, CSV, formatting, and wrappers).
// Imports the math/color rendering functions from util_core.js.

import Papa from "papaparse";


// Core numeric and color helpers (Node-safe)
export * from "./util_core.js";

export const SAMPLES_HOME =
  "https://raw.githubusercontent.com/ome/ome2024-ngff-challenge/main/samples/ngff_samples.csv";

import YAML from "yaml";

const DEFAULT_YAML_URL = `${import.meta.env.BASE_URL}config.yaml`;
let _viewConfigPromise = null;

// Lazy-load and cache the YAML config the first time it's needed
export async function getViewConfig() {
  if (_viewConfigPromise) return _viewConfigPromise;

  _viewConfigPromise = (async () => {
    try {
      const txt = await fetch(DEFAULT_YAML_URL).then((r) => r.text());
      const cfg = YAML.parse(txt) || {};
      const whitelist = new Set((cfg.samples || []).map((u) => (u || "").trim()));
      const overrides = new Map();

      for (const item of cfg.extended_samples || []) {
        if (item && item.url) {
          const { url, ...rest } = item;
          overrides.set((url || "").trim(), rest);
        }
      }

      console.log("Overrides:", { overrides });
      // allow both samples + extended
      const allowed = new Set([...whitelist, ...overrides.keys()]);
      const predicate = (row) => allowed.has((row.url || "").trim());

      return { predicate, overrides };
    } catch (err) {
      console.warn("No YAML view config found, showing all rows.", err);
      // fallback: no filtering, no overrides
      return { predicate: () => true, overrides: new Map() };
    }
  })();

  return _viewConfigPromise;
}


// ──────────────────────────────────────────────
// FRONTEND-ONLY HELPERS
// ──────────────────────────────────────────────


export function loadCsv(csvUrl, ngffTable, parentRow = {}) {
  Papa.parse(csvUrl, {
    header: false,
    download: true,
    skipEmptyLines: "greedy",
    complete: async (results) => {
      let colNames = ["url"];
      let firstRow = results.data[0];
      if (firstRow.length > 1) {
        colNames = firstRow;
        results.data.shift();
      }
      const dataRows = results.data.map((row) => {
        const rowObj = { ...parentRow };
        for (let i = 0; i < colNames.length; i++) {
          rowObj[colNames[i]] = row[i];
        }
        return rowObj;
      });

      let zarrUrlRows


      // ───── apply whitelist + overrides from YAML (optional) ─────
      const { predicate, overrides } = await getViewConfig();
      zarrUrlRows = dataRows
        .filter(predicate)
        .map((row) => {
          const patch = overrides.get((row.url || "").trim());
          const updatedRow = patch ? Object.assign(row, patch) : row;
          // Set default collection if not defined
          if (!updatedRow.collection) {
            updatedRow.collection = "none"; // or whatever default you want
          }
          return updatedRow;
        });

      const unique = {};
      zarrUrlRows.forEach((row) => {
        if (!unique[row.url]) unique[row.url] = row;
      });
      zarrUrlRows = Object.values(unique);

      const plate_count = zarrUrlRows.reduce(
        (acc, r) => (r.wells ? acc + 1 : acc),
        0
      );
      const bytes = zarrUrlRows.reduce(
        (acc, r) => acc + parseInt(r.written || 0),
        0
      );
      let image_count = zarrUrlRows.length;
      if (plate_count > 0) {
        image_count = zarrUrlRows.reduce(
          (acc, r) => acc + parseInt(r.images || 1),
          0
        );
      }

      ngffTable.addRows(zarrUrlRows);

    },
  });
}

export async function getJson(url) {
  return await fetch(url).then((r) => r.json());
}

export function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export async function lookupOrganism(taxonId) {
  const id = taxonId.replace("NCBI:txid", "");
  const res = await getJson(
    `https://rest.ensembl.org/taxonomy/id/${id}?content-type=application/json`
  );
  return res.name || taxonId;
}

export async function lookupImagingModality(fbbiId) {
  const fbbi_id = fbbiId.replace("obo:", "");
  const res = await getJson(
    `https://www.ebi.ac.uk/ols4/api/ontologies/fbbi/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252F${fbbi_id}`
  );
  return res.label;
}

export function filesizeformat(bytes) {
  if (!bytes) return "";
  const round = 2;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(round)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(round)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(round)} GB`;
  if (bytes < 1024 ** 5) return `${(bytes / 1024 ** 4).toFixed(round)} TB`;
  return `${(bytes / 1024 ** 5).toFixed(round)} PB`;
}

export function range(start, end) {
  return Array.from({ length: end - start }, (_, i) => i + start);
}
