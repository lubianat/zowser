<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { generateThumbnail } from "./thumbnailGenerator.js";

  export let source;
  export let attrs;
  export let thumbDatasetIndex = undefined;
  export let thumbAspectRatio = 1;
  export let cssSize = 120;
  export let max_size = 512;

  let canvas;
  let imgEl;

  // initial css box respecting aspect ratio
  let width = cssSize;
  let height = cssSize;
  if (thumbAspectRatio > 1) height = width / thumbAspectRatio;
  else if (thumbAspectRatio < 1) width = height * thumbAspectRatio;
  let cssWidth = width;
  let cssHeight = height;

  let showSpinner = true;
  // mode: 'none' | 'cached' | 'live'
  let mode = "none";

  const controller = new AbortController();

  function basenameFromSource(src) {
    try {
      const u = new URL(src, window.location.href);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1];
    } catch {
      const parts = src.split("?")[0].split("/");
      return parts[parts.length - 1];
    }
  }

  async function tryCachedFirst() {
    const base = basenameFromSource(source);
    const cachedUrl = `/thumbs/${base}.jpg`;

    // Preload without touching DOM; switch atomically on load
    const probe = new Image();
    probe.decoding = "async";
    probe.referrerPolicy = "no-referrer";
    return new Promise((resolve) => {
      probe.onload = () => {
        mode = "cached";
        showSpinner = false;
        imgEl.src = cachedUrl; // show cached immediately
        resolve(true);
      };
      probe.onerror = () => resolve(false);
      probe.src = cachedUrl;
    });
  }

  async function loadFromZarr() {
    mode = "live"; // ensure canvas is visible under spinner

    const result = await generateThumbnail(
      source,
      attrs,
      thumbDatasetIndex,
      max_size,
      controller.signal,
    );

    if (!result) {
      // Keep spinner indefinitely (requested behavior).
      console.warn("Thumbnail generation skipped/failed:", source);
      return;
    }

    const { rgb, width: w, height: h } = result;
    width = w;
    height = h;

    // Fit within cssSize while preserving aspect ratio
    let scale = Math.max(width, height) / cssSize;
    if (scale < 1) scale = 1;
    cssWidth = width / scale;
    cssHeight = height / scale;

    await tick(); // ensure canvas is in the DOM and sized
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(rgb, width, height), 0, 0);
    showSpinner = false;
  }

  onMount(async () => {
    const hasCached = await tryCachedFirst();
    if (!hasCached) {
      // spinner remains visible while generating
      await loadFromZarr();
    }
  });

  onDestroy(() => controller.abort());
</script>

<div
  class="canvasWrapper"
  style="width:{cssWidth}px; height:{cssHeight}px;"
  class:spinner={showSpinner}
>
  <!-- Cached image (hidden until confirmed loaded) -->
  <img
    bind:this={imgEl}
    class:hidden={mode !== "cached"}
    style="width:{cssWidth}px; height:{cssHeight}px; object-fit:cover;"
    alt=""
    aria-hidden={mode !== "cached"}
  />

  <!-- Live NGFF canvas (always present; spinner overlays until drawn) -->
  <canvas
    bind:this={canvas}
    class:hidden={mode !== "live"}
    style="width:{cssWidth}px; height:{cssHeight}px; background-color: lightgrey;"
    {width}
    {height}
  />
</div>

<style>
  .hidden {
    display: none;
  }

  .canvasWrapper {
    position: relative;
  }
  canvas {
    box-shadow: 5px 4px 10px -5px #737373;
  }

  @keyframes spinner {
    to {
      transform: rotate(360deg);
    }
  }

  .spinner::after {
    content: "";
    box-sizing: border-box;
    position: absolute;
    inset: 50% auto auto 50%;
    width: 40px;
    height: 40px;
    margin-left: -20px;
    margin-top: -20px;
    border-radius: 50%;
    border: 5px solid rgba(180, 180, 180, 0.6);
    border-top-color: rgba(0, 0, 0, 0.6);
    animation: spinner 0.6s linear infinite;
  }
</style>
