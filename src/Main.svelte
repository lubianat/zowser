<script>
  import { ngffTable } from "./tableStore";
  import { organismStore, imagingModalityStore } from "./ontologyStore";
  import ColumnSort from "./ColumnSort.svelte";
  import ImageList from "./ImageList.svelte";
  import PreviewPopup from "./PreviewPopup.svelte";
  import form_select_bg_img from "/selectCaret.svg";
  import zarr_samples from "/samples/zarrs_metadata.csv?url";

  import PageTitle from "./PageTitle.svelte";
  import { loadCsv } from "./util";

  // hardcode to local samples
  let csvUrl = zarr_samples;

  let tableRows = [];
  // e.g. {"IDR": {"idr0004.csv": {"count": 100}}, "JAX": {}...
  let totalZarrs = 0;
  let totalBytes = 0;
  let showSourceColumn = false;
  let organismIdsByName = {};
  let imagingModalityIdsByName = {};

  $: dimensionFilter = "";
  $: organismFilter = "";
  $: imagingModalityFilter = "";
  $: textFilter = "";

  // The ngffTable is built as CSV files are loaded
  // it is NOT filtered
  ngffTable.subscribe((rows) => {
    tableRows = filterRows(rows);
    // NB: don't use filtered rows for sources
    totalZarrs = rows.length;
    totalBytes = rows.reduce((acc, row) => {
      return acc + parseInt(row["written"]) || 0;
    }, 0);
  });

  organismStore.subscribe((ontologyTerm) => {
    // iterate over ontologyTerm key, values
    let temp = {};
    for (const [orgId, name] of Object.entries(ontologyTerm)) {
      temp[name] = orgId;
    }
    organismIdsByName = temp;
  });

  imagingModalityStore.subscribe((ontologyTerm) => {
    let temp = {};
    for (const [orgId, name] of Object.entries(ontologyTerm)) {
      temp[name] = orgId;
    }
    imagingModalityIdsByName = temp;
  });

  $: showSourceColumn = tableRows.some((row) => row.source);

  if (csvUrl) {
    loadCsv(csvUrl, ngffTable);
  }

  let sortedBy = "";
  let sortAscending = false;
  function toggleSortAscending() {
    sortAscending = !sortAscending;
    ngffTable.sortTable(sortedBy, sortAscending);
  }
  function handleSort(event) {
    sortedBy = event.target.value;
    if (sortedBy === "") {
      ngffTable.sortTable("index", true);
    } else {
      ngffTable.sortTable(sortedBy, sortAscending);
    }
  }

  // Main filtering function
  function filterRows(rows) {
    if (dimensionFilter !== "") {
      rows = rows.filter((row) => {
        return row.dim_count == dimensionFilter;
      });
    }
    if (organismFilter !== "") {
      rows = rows.filter((row) => {
        return row.organismId == organismFilter;
      });
    }
    if (imagingModalityFilter != "") {
      rows = rows.filter((row) => {
        return row.fbbiId == imagingModalityFilter;
      });
    }
    if (textFilter && textFilter != "") {
      let txt = textFilter.toLowerCase();
      rows = rows.filter((row) => {
        return (
          row.url.toLowerCase().includes(txt) ||
          row.description?.toLowerCase().includes(txt) ||
          row.name?.toLowerCase().includes(txt)
        );
      });
    }
    return rows;
  }

  function filterDimensions(event) {
    dimensionFilter = event.target.value || "";
    tableRows = filterRows(ngffTable.getRows());
  }

  function filterOrganism(event) {
    organismFilter = event.target.value || "";
    tableRows = filterRows(ngffTable.getRows());
  }

  function filterImagingModality(event) {
    imagingModalityFilter = event.target.value || "";
    tableRows = filterRows(ngffTable.getRows());
  }

  function filterText(event) {
    textFilter = event.target.value;
    tableRows = filterRows(ngffTable.getRows());
  }

  // Reactive helper lists (Option 1 - cross-filter)
  $: allRows = ngffTable.getRows();

  // Dynamically derive which dimensions exist at all
  $: allDimensionValues = Array.from(
    new Set(allRows.map((r) => String(r.dim_count)).filter(Boolean)),
  ).sort();

  // Available dimensions given current organism/modality filters
  $: availableDimensions =
    allRows.length === 0
      ? allDimensionValues // show all (none yet means later it fills)
      : Array.from(
          new Set(
            allRows
              .filter(
                (r) =>
                  (organismFilter ? r.organismId === organismFilter : true) &&
                  (imagingModalityFilter
                    ? r.fbbiId === imagingModalityFilter
                    : true),
              )
              .map((r) => String(r.dim_count))
              .filter(Boolean),
          ),
        ).sort();

  // Available organisms given current modality and dimension filters
  $: availableOrganismIds =
    allRows.length === 0
      ? Object.values(organismIdsByName)
      : Array.from(
          new Set(
            allRows
              .filter(
                (r) =>
                  (imagingModalityFilter
                    ? r.fbbiId === imagingModalityFilter
                    : true) &&
                  (dimensionFilter
                    ? String(r.dim_count) === dimensionFilter
                    : true),
              )
              .map((r) => r.organismId)
              .filter(Boolean),
          ),
        );

  // Available imaging modalities given current organism and dimension filters
  $: availableImagingIds =
    allRows.length === 0
      ? Object.values(imagingModalityIdsByName)
      : Array.from(
          new Set(
            allRows
              .filter(
                (r) =>
                  (organismFilter ? r.organismId === organismFilter : true) &&
                  (dimensionFilter
                    ? String(r.dim_count) === dimensionFilter
                    : true),
              )
              .map((r) => r.fbbiId)
              .filter(Boolean),
          ),
        );
</script>

<PreviewPopup />

<main style="--form-select-bg-img: url('{form_select_bg_img}')">
  <!-- <h1 class="title">OME 2024 NGFF Challenge</h1> -->

  <div class="summary">
    <PageTitle />
    <!-- 
    
    TODO: Integrate with BioFileFinder
    <h3 style="text-align:center">
      <div style="font-size: 90%">
        <a href={csvUrl}>metadata.csv</a>
      </div>
    </h3> -->

    <div class="textInputWrapper">
      <input
        bind:value={textFilter}
        on:input={filterText}
        placeholder="Filter by Name or Description"
        name="textFilter"
      />
      <button
        title="Clear Filter"
        style="visibility: {textFilter !== '' ? 'visible' : 'hidden'}"
        on:click={filterText}
        >&times;
      </button>
    </div>
  </div>

  <!-- start left side-bar (moves to top for mobile) -->
  <div class="sidebarContainer">
    <div class="sidebar">
      <div class="filters">
        <div style="white-space: nowrap;">Filter by:</div>

        <div class="selectWrapper">
          <select bind:value={dimensionFilter} on:change={filterDimensions}>
            <option value="">
              {dimensionFilter !== "" ? "All Dimensions" : "Dimension Count"}
            </option>
            <hr />
            {#each allDimensionValues as dim}
              {#if availableDimensions.includes(dim)}
                <option value={dim}>{dim}D</option>
              {/if}
            {/each}
          </select>

          <div>
            <button
              title="Clear Filter"
              style="visibility: {dimensionFilter !== ''
                ? 'visible'
                : 'hidden'}"
              on:click={filterDimensions}
              >&times;
            </button>
          </div>
        </div>

        <div class="selectWrapper">
          <select bind:value={organismFilter} on:change={filterOrganism}>
            <option value=""
              >{organismFilter == "" ? "Organism" : "All Organisms"}</option
            >
            <hr />
            {#each Object.keys(organismIdsByName)
              .sort()
              .filter( (name) => availableOrganismIds.includes(organismIdsByName[name]), ) as name}
              <option value={organismIdsByName[name]}>{name}</option>
            {/each}
          </select>
          <div>
            <button
              title="Clear Filter"
              style="visibility: {organismFilter !== '' ? 'visible' : 'hidden'}"
              on:click={filterOrganism}
              >&times;
            </button>
          </div>
        </div>

        <div class="selectWrapper">
          <select
            bind:value={imagingModalityFilter}
            on:change={filterImagingModality}
          >
            <option value=""
              >{imagingModalityFilter == ""
                ? "Imaging Modality"
                : "All Modalities"}</option
            >
            <hr />
            {#each Object.keys(imagingModalityIdsByName)
              .sort()
              .filter( (name) => availableImagingIds.includes(imagingModalityIdsByName[name]), ) as name (name)}
              <option value={imagingModalityIdsByName[name]}>{name}</option>
            {/each}
          </select>
          <div>
            <button
              title="Clear Filter"
              style="visibility: {imagingModalityFilter !== ''
                ? 'visible'
                : 'hidden'}"
              on:click={filterImagingModality}
              >&times;
            </button>
          </div>
        </div>

        <div class="clear"></div>

        <div>Sort by:</div>
        <div class="selectWrapper">
          <select on:change={handleSort}>
            <option value="">--</option>
            <hr />
            {#each ["x", "y", "z", "c", "t"] as dim}
              <option value="size_{dim}">Size: {dim.toUpperCase()}</option>
            {/each}
            <hr />
            <option value="written">Data Size (bytes)</option>
            <option value="chunk_pixels">Chunk Size (pixels)</option>
            <option value="shard_pixels">Shard Size (pixels)</option>
          </select>
          <div>
            <ColumnSort toggleAscending={toggleSortAscending} {sortAscending} />
          </div>
        </div>
      </div>
    </div>

    <div class="results">
      <h3 style="margin-left: 15px">
        Showing {tableRows.length} out of {totalZarrs} images
      </h3>
      <ImageList {tableRows} {textFilter} {sortedBy} />
    </div>
  </div>
</main>

<style>
  .sidebarContainer {
    display: flex;
    flex-direction: row;
  }

  .sidebar {
    flex: 250px 0 0;
    padding: 10px;
  }
  .results {
    flex: auto 1 1;
    position: relative;
  }

  input[name="textFilter"] {
    width: 100%;
    flex: auto 1 1;
    border: solid var(--border-color) 1px;
    border-radius: 16px;
    padding: 8px 8px 6px 12px;
    font-size: 1rem;
    background-color: var(--light-background);
    position: relative;
    display: block;
  }
  /* Add a X over the input */
  input[name="textFilter"]::before {
    content: "Where is this going?";
    width: 200px;
    height: 200px;
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: block;
  }

  @media (max-width: 800px) {
    .sidebarContainer {
      flex-direction: column;
    }
  }
  select {
    display: block;
    width: 100%;
    padding: 0.3rem 2.25rem 0.3rem 0.75rem;
    font-size: 1rem;
    line-height: 1.5;
    appearance: none;
    background-color: var(--light-background);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    margin: 3px 0;
    float: left;
    background-image: var(--form-select-bg-img);
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 16px 12px;
  }

  .selectWrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 5px;
  }
  .selectWrapper > select {
    flex: auto 1 1;
  }
  .selectWrapper > div {
    flex: 0 0 20px;
    cursor: pointer;
  }
  .selectWrapper button,
  .textInputWrapper button {
    background: transparent;
    border: none;
    padding: 2px;
    font-size: 24px;
  }
  .textInputWrapper {
    position: relative;
    max-width: 600px;
    margin: 0 auto 10px auto;
  }
  .textInputWrapper button {
    position: absolute;
    right: 7px;
    top: -1px;
  }

  .sources {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 5px;
    max-width: 1330px;
    margin: 0 auto;
  }
  .filters {
    gap: 10px;
    margin: 5px 0;
  }
  main {
    flex: auto 1 1;
    overflow: scroll;
    width: 100%;
    display: flex;
    flex-direction: column;
    margin: auto;
  }

  .summary {
    z-index: 20;
    padding: 0 10px 10px 10px;
    flex: auto 0 0;
    position: relative;
  }
  .results h3 {
    margin: 10px;
  }
</style>
