// src/util.js
// Frontend utilities (logos, CSV, formatting, and wrappers).
// Imports the math/color rendering functions from util_core.js.

import Papa from "papaparse";

// Static assets (only usable in browser/Vite builds)
import idrLogo from "/idr-mark.svg";
import nfdi4bioimage from "/nfdi4bioimage.png";
import ssbdLogo from "/ssbd-logo.png";

// Core numeric and color helpers (Node-safe)
export * from "./util_core.js";

export const SAMPLES_HOME =
  "https://raw.githubusercontent.com/ome/ome2024-ngff-challenge/main/samples/ngff_samples.csv";


// ──────────────────────────────────────────────
// FRONTEND-ONLY HELPERS
// ──────────────────────────────────────────────


export function loadCsv(csvUrl, ngffTable, parentRow = {}) {
  Papa.parse(csvUrl, {
    header: false,
    download: true,
    skipEmptyLines: "greedy",
    complete: (results) => {
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

      let zarrUrlRows = dataRows.filter((r) => !r.url?.endsWith(".csv"));
      const childCsvRows = dataRows.filter((r) => r.url?.endsWith(".csv"));

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

      ngffTable.addCsv(csvUrl, childCsvRows, image_count, plate_count, bytes);
      ngffTable.addRows(zarrUrlRows);

      // Recursive child CSV loading
      childCsvRows.forEach((child) => {
        const childUrl = child.url;
        child.csv = childUrl;
        loadCsv(childUrl, ngffTable, child);
      });
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
