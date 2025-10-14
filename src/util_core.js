// src/util_core.js
// Pure computational and color utilities — Node-safe!

export function getMinMaxValues(chunk2d) {
    const data = chunk2d.data;
    let maxV = 0;
    let minV = Infinity;
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val > maxV) maxV = val;
        if (val < minV) minV = val;
    }
    return [minV, maxV];
}

export function hexToRGB(hex) {
    if (hex.startsWith("#")) hex = hex.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
}

// constants
export const MAX_CHANNELS = 4;
export const COLORS = {
    cyan: "#00FFFF",
    yellow: "#FFFF00",
    magenta: "#FF00FF",
    red: "#FF0000",
    green: "#00FF00",
    blue: "#0000FF",
    white: "#FFFFFF",
};
export const MAGENTA_GREEN = [COLORS.magenta, COLORS.green];
export const RGB = [COLORS.red, COLORS.green, COLORS.blue];
export const CYMRGB = Object.values(COLORS).slice(0, -2);

export function getDefaultVisibilities(n) {
    if (n <= MAX_CHANNELS) return Array(n).fill(true);
    return [
        ...Array(MAX_CHANNELS).fill(true),
        ...Array(n - MAX_CHANNELS).fill(false),
    ];
}

export function getDefaultColors(n, visibilities) {
    let colors = [];
    if (n == 1) colors = [COLORS.white];
    else if (n == 2) colors = MAGENTA_GREEN;
    else if (n == 3) colors = RGB;
    else if (n <= MAX_CHANNELS) colors = CYMRGB.slice(0, n);
    else {
        colors = Array(n).fill(COLORS.white);
        const visibleIndices = visibilities.flatMap((v, i) => (v ? i : []));
        for (const [i, idx] of visibleIndices.entries()) {
            colors[idx] = CYMRGB[i];
        }
    }
    return colors.map(hexToRGB);
}

export function renderTo8bitArray(ndChunks, minMaxValues, colors) {
    const shape = ndChunks[0].shape;
    const height = shape[0];
    const width = shape[1];
    const pixels = height * width;
    const rgba = new Uint8ClampedArray(4 * pixels).fill(0);
    let offset = 0;

    for (let y = 0; y < pixels; y++) {
        for (let p = 0; p < ndChunks.length; p++) {
            const rgb = colors[p];
            const data = ndChunks[p].data;
            const range = minMaxValues[p];
            const rawValue = data[y];
            const fraction = (rawValue - range[0]) / (range[1] - range[0]);
            for (let i = 0; i < 3; i++) {
                const v = (fraction * rgb[i]) << 0;
                rgba[offset * 4 + i] = Math.max(rgba[offset * 4 + i], v);
            }
        }
        rgba[offset * 4 + 3] = 255;
        offset++;
    }

    return rgba;
}
