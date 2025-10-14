<!-- 
Modified from ome/ome-ngff-validator; 

Copyright (c) 2022, OME Team
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. -->
<!-- OpenWith.svelte -->

<script>
  import "./shared_button.css";
  import checkImage from "/ome-logomark.svg";
  import viewers_json from "/public/ngff_viewers.json";
  import vizarr_logo from "/vizarr_logo.png";
  import copy_icon from "/copy.png";

  export let source;
  export let dtype;
  export let version;

  // ──────────────── Viewer list setup ────────────────
  let viewers = viewers_json.viewers.map((viewer_data) => {
    let href = viewer_data.href;
    if (href) {
      href = href.includes("{URL}")
        ? href.replace("{URL}", source)
        : href + source;
    }
    const logo_path = vizarr_logo.replace("/vizarr_logo.png", viewer_data.logo);
    return { ...viewer_data, href, logo_path };
  });

  if (version === "0.5") {
    viewers = viewers.filter((viewer) => viewer.name !== "itk-vtk-viewer");
  }

  // ──────────────── Copy logic (from CopyButton) ────────────────
  let shaking = {};

  function copyTextToClipboard(copy_text, key) {
    const textArea = document.createElement("textarea");
    textArea.value = copy_text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    shaking[key] = true;
    setTimeout(() => (shaking[key] = false), 1000);
  }
</script>

<div class="openwith">
  <div class="viewerRow">
    <!-- Standalone copy button -->
    <button
      class="inlineButton"
      title="Copy URL"
      on:click={() => copyTextToClipboard(source, "bigCopyButton")}
    >
      <img
        class="viewer_icon"
        class:shaking={shaking.bigCopyButton}
        src={copy_icon}
      />
    </button>
    <!-- Validator -->
    <a
      class="inlineButton"
      title="Validate NGFF"
      target="_blank"
      href={`https://ome.github.io/ome-ngff-validator/?source=${source}`}
    >
      <img class="viewer_icon" src={checkImage} alt="Validator" />
    </a>

    <!-- Each viewer -->
    {#each viewers as viewer, i}
      <div class="viewerItem">
        {#if viewer.href}
          <a
            class="inlineButton"
            title="View {dtype} in {viewer.name}"
            target="_blank"
            href={viewer.href}
          >
            <img class="viewer_icon" src={viewer.logo_path} alt="Viewer logo" />
          </a>
        {:else}
          <button
            class="inlineButton"
            title="Copy URL"
            on:click={() => copyTextToClipboard(source, i)}
          >
            <img class="viewer_icon" src={viewer.logo_path} alt="Viewer Icon" />
            <img
              class="smallCopyBtn"
              class:shaking={shaking[i]}
              src={copy_icon}
              alt="Copy Icon"
            />
          </button>
        {/if}

        {#if viewer.html}
          <div class="viewer_html">
            {@html viewer.html.replace("{URL}", source)}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
