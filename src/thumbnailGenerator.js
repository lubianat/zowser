// src/thumbnailGenerator.js
import * as zarr from "zarrita";
import {
    renderTo8bitArray,
    getMinMaxValues,
    getDefaultVisibilities,
    hexToRGB,
    getDefaultColors,
} from "./util_core.js";


export async function loadMultiscales(url, signal) {
    let zarrData;
    try {
        const res = await fetch(`${url}/zarr.json`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}/zarr.json`);
        zarrData = await res.json();
    } catch (err) {
        console.warn(`[ngffLoader] ${url}/zarr.json not found or invalid`, err.message);
        return [undefined, url];
    }

    const attrs = zarrData?.attributes?.ome;
    if (!attrs) return [undefined, url];

    // Plain image
    if (attrs.multiscales) return [attrs, url];

    // Plate-style (multi-well)
    if (attrs.plate) {
        const well = attrs.plate.wells[0];
        const imgPath = `${url}/${well.path}/0`;
        const [msData, msUrl] = await loadMultiscales(imgPath, signal);
        return [msData, msUrl, attrs.plate];
    }

    // Bioformats2raw layout
    if (attrs["bioformats2raw.layout"]) {
        const bf2rawUrl = `${url}/0`;
        return await loadMultiscales(bf2rawUrl, signal);
    }

    return [undefined, url];
}


export async function generateThumbnail(source, attrs, thumbDatasetIndex, maxSize = 512, signal) {
    if (!attrs?.multiscales?.length) return null;

    const paths = attrs.multiscales[0].datasets.map((d) => d.path);
    const axes = attrs.multiscales[0].axes.map((a) => a.name);

    let path = paths.at(-1);
    if (thumbDatasetIndex !== undefined && thumbDatasetIndex < paths.length)
        path = paths[thumbDatasetIndex];

    const store = new zarr.FetchStore(`${source}/${path}`);
    const arr = await zarr.open.v3(store, { kind: "array" });

    const chDim = axes.indexOf("c");
    const shape = arr.shape;

    if (shape.at(-1) * shape.at(-2) > maxSize * maxSize) {
        console.log("Thumbnail skipped, too large:", shape, source);
        return null;
    }

    const channelCount = shape[chDim] || 1;
    const vis = attrs?.omero?.channels
        ? attrs.omero.channels.map((ch) => ch.active)
        : getDefaultVisibilities(channelCount);
    const colors = attrs?.omero?.channels
        ? attrs.omero.channels.map((ch) => hexToRGB(ch.color))
        : getDefaultColors(channelCount, vis);

    const active = vis.reduce((a, on, i) => (on ? [...a, i] : a), []);
    const slicesFor = (ch) =>
        shape.map((dim, i) => {
            if (i === chDim) return ch;
            if (i >= shape.length - 2) return { start: 0, stop: dim, step: 1 };
            return parseInt(dim / 2);
        });

    const chunks = await Promise.all(
        active.map((ch) => zarr.get(arr, slicesFor(ch), { opts: { signal } }))
    );

    const minmax = chunks.map(getMinMaxValues);
    const rgb = renderTo8bitArray(chunks, minmax, colors);

    return { rgb, width: shape.at(-1), height: shape.at(-2) };
}
