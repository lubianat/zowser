from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path

import requests
import yaml


# ────────────────────────────────────────────────────────────────────────────────
# Logging configuration
# ────────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("load_zarr_stats")

# ────────────────────────────────────────────────────────────────────────────────
# Path configuration
# ────────────────────────────────────────────────────────────────────────────────
HERE = Path(__file__).parent


# ────────────────────────────────────────────────────────────────────────────────
# Utility functions
# ────────────────────────────────────────────────────────────────────────────────
def load_json(url: str):
    try:
        log.debug(f"Fetching JSON: {url}")
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except (requests.exceptions.RequestException, json.decoder.JSONDecodeError) as e:
        log.warning(f"Failed to load JSON from {url}: {e}")
        return {}


def format_bytes_human_readable(num_bytes):
    unit = None
    for u in ["B", "KB", "MB", "GB", "TB"]:
        unit = u
        if num_bytes < 1024.0:
            break
        num_bytes /= 1024.0
    return f"{num_bytes:.2f} {unit}"


def list_to_str(my_list):
    if not my_list:
        return ""
    return ",".join(str(item) for item in my_list)


# ────────────────────────────────────────────────────────────────────────────────
# Zarr metadata utilities
# ────────────────────────────────────────────────────────────────────────────────
def get_chunk_and_shard_shapes(zarray):
    """Returns dict with 'shape', 'chunks' and 'shards' keys (if shards are present)"""
    if "chunks" in zarray:
        return {"chunks": zarray["chunks"], "shape": zarray["shape"]}

    chunk_shape = (
        zarray.get("chunk_grid", {}).get("configuration", {}).get("chunk_shape")
    )
    sharding_codecs = [
        codec
        for codec in zarray.get("codecs", [])
        if codec.get("name") == "sharding_indexed"
    ]
    if len(sharding_codecs) > 0:
        sub_chunks = (
            sharding_codecs[0].get("configuration", {}).get("chunk_shape")
            if sharding_codecs
            else None
        )
        if sub_chunks:
            return {
                "chunks": sub_chunks,
                "shards": chunk_shape,
                "shape": zarray["shape"],
            }
    return {"chunks": chunk_shape, "shape": zarray["shape"]}


def get_array_values(zarr_url, multiscales):
    """Extracts chunk/shard/shape info and total written bytes."""
    dict_data = None
    for ds in multiscales[0]["datasets"]:
        array_url = zarr_url + "/" + ds["path"]
        array_json = load_json(array_url + "/zarr.json")
        if dict_data is None:
            dict_data = get_chunk_and_shard_shapes(array_json)
            dict_data["written"] = 0
        stats = array_json.get("attributes", {}).get(
            "_ome2024_ngff_challenge_stats", {}
        )
        dict_data["written"] += stats.get("written", 0)
        dict_data["dimension_names"] = array_json.get("dimension_names", "")
    return dict_data


def load_rocrate(zarr_url):
    rocrate_json = load_json(zarr_url + "/ro-crate-metadata.json")
    rc_graph = rocrate_json.get("@graph", {})
    license = name = description = organismId = fbbiId = None

    for item in rc_graph:
        if item.get("license"):
            license = item["license"]
        if item.get("name"):
            name = item["name"]
        if item.get("description"):
            description = item["description"]
        if item.get("@type") == "biosample":
            organismId = item.get("organism_classification", {}).get("@id")
        if item.get("@type") == "image_acquisition":
            fbbiId = item.get("fbbi_id", {}).get("@id")

    return {
        "license": license,
        "name": name,
        "description": description,
        "organismId": organismId,
        "fbbiId": fbbiId,
    }


def load_series(zarr_url):
    """Return a list of series identifiers."""
    series_url = zarr_url + "/OME/METADATA.ome.xml"
    rsp = requests.get(series_url)
    if (rsp.status_code // 100) != 2:
        series_json = load_json(zarr_url + "/OME/zarr.json")
        return series_json.get("attributes", {}).get("ome", {}).get("series", [])
    return ["0"]


# ────────────────────────────────────────────────────────────────────────────────
# Main Zarr loader
# ────────────────────────────────────────────────────────────────────────────────
def load_zarr(zarr_url, average_count=5, flat=False):
    log.info(f"Loading Zarr: {zarr_url}")

    # Assuming v0.5
    response = load_json(zarr_url + "/zarr.json")

    if not response:
        log.error(f"No zarr.json found at {zarr_url}")
        return {}

    rocrate_data = load_rocrate(zarr_url)
    log.debug(f"Loaded Ro-Crate metadata: {rocrate_data}")

    ome_json = response.get("attributes", {}).get("ome", {})
    multiscales = ome_json.get("multiscales")
    plate = ome_json.get("plate")
    bf2raw = ome_json.get("bioformats2raw.layout")

    stats = None

    # ────────────────────────────────
    # FLAT MODE (fast, non-recursive)
    # ────────────────────────────────
    if flat:
        log.debug("Flat mode enabled — skipping deep traversal")
        stats = {"written": 0}
        if multiscales:
            ds_path = multiscales[0]["datasets"][0]["path"]
            arr_json = load_json(zarr_url + "/" + ds_path + "/zarr.json")
            if arr_json:
                stats.update(get_chunk_and_shard_shapes(arr_json))
                stats["written"] = (
                    arr_json.get("attributes", {})
                    .get("_ome2024_ngff_challenge_stats", {})
                    .get("written", 0)
                )
                stats["dimension_names"] = arr_json.get("dimension_names", "")

        # In flat mode, still process bf2raw layout
        if bf2raw:
            log.debug("→ Using bioformats2raw layout")
            series = load_series(zarr_url)
            if series:
                bf_img_json = load_json(zarr_url + f"/{series[0]}/zarr.json")
                bf_img_ms = (
                    bf_img_json.get("attributes", {}).get("ome", {}).get("multiscales")
                )
                if bf_img_ms:
                    stats = get_array_values(zarr_url + f"/{series[0]}", bf_img_ms)
                else:
                    log.warning("Missing multiscales in first series image")
            else:
                log.warning("No series found in bioformats2raw layout")
        stats.update(rocrate_data)
        return stats

    # ────────────────────────────────
    # FULL (deep) MODE
    # ────────────────────────────────
    log.debug(
        f"Detected structure: multiscales={bool(multiscales)}, "
        f"plate={bool(plate)}, bf2raw={bool(bf2raw)}"
    )

    if multiscales is not None:
        log.debug("→ Using multiscales data")
        stats = get_array_values(zarr_url, multiscales)

    elif plate is not None:
        log.debug("→ Using plate data")
        written_values = []
        for well in plate["wells"][:average_count]:
            field_path = f"{well['path']}/0"
            plate_img_url = f"{zarr_url}/{field_path}/zarr.json"
            plate_img_json = load_json(plate_img_url)
            plate_ome_json = plate_img_json.get("attributes", {}).get("ome", {})
            plate_img = plate_ome_json.get("multiscales")
            if plate_img:
                img_stats = get_array_values(zarr_url + "/" + field_path, plate_img)
                if img_stats.get("written", 0) > 0:
                    written_values.append(img_stats["written"])
                    stats = img_stats
            else:
                log.warning(f"Missing multiscales in plate image {field_path}")

        avg_written = sum(written_values) / len(written_values) if written_values else 0
        image_count = len(plate["wells"]) * plate.get("field_count", 1)
        stats = stats or {}
        stats["written"] = avg_written * image_count
        log.debug(f"Computed average written={avg_written}, total images={image_count}")

    elif bf2raw:
        log.debug("→ Using bioformats2raw layout")
        series = load_series(zarr_url)
        if series:
            bf_img_json = load_json(zarr_url + f"/{series[0]}/zarr.json")
            bf_img_ms = (
                bf_img_json.get("attributes", {}).get("ome", {}).get("multiscales")
            )
            if bf_img_ms:
                stats = get_array_values(zarr_url + f"/{series[0]}", bf_img_ms)
            else:
                log.warning("Missing multiscales in first series image")
        else:
            log.warning("No series found in bioformats2raw layout")

    else:
        log.warning("No recognized OME structure found in zarr.json")

    if stats is None:
        log.error("Could not determine stats for this Zarr")
        stats = {}

    stats.update(rocrate_data)
    log.debug(f"Final stats keys: {list(stats.keys())}")
    return stats


# ────────────────────────────────────────────────────────────────────────────────
# Input parser
# ────────────────────────────────────────────────────────────────────────────────
def extract_zarr_urls(input_path: str) -> list[str]:
    with Path(input_path).open() as f:
        data = yaml.safe_load(f)

    urls = []
    if not data or "sample" not in data:
        return urls

    sample_val = data["sample"]
    if isinstance(sample_val, str):
        urls.append(sample_val)
    elif isinstance(sample_val, list):
        for item in sample_val:
            if isinstance(item, str):
                urls.append(item)
    return urls


# ────────────────────────────────────────────────────────────────────────────────
# Main entry point
# ────────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Hydrate NGFF Zarr stats to CSV.")
    parser.add_argument("input_path", help="YAML file with sample Zarr URLs")
    parser.add_argument(
        "-v",
        "--verbose",
        action="count",
        default=0,
        help="Increase verbosity (-v, -vv)",
    )
    parser.add_argument(
        "--flat",
        action="store_true",
        help="Skip traversal into plate wells or series; only load top-level zarr.json",
    )
    args = parser.parse_args()

    if args.verbose >= 2:
        log.setLevel(logging.DEBUG)
    elif args.verbose == 1:
        log.setLevel(logging.INFO)
    else:
        log.setLevel(logging.WARNING)

    input_path = HERE / "sample_zarrs.yaml"
    output_csv = HERE / "sample_zarrs_hydrated.csv"

    column_names = [
        "url",
        "mode",
        "written",
        "written_human_readable",
        "shape",
        "shards",
        "chunks",
        "dimension_names",
        "license",
        "name",
        "description",
        "organismId",
        "fbbiId",
    ]

    unique_urls = set(extract_zarr_urls(input_path))
    log.info(f"Found {len(unique_urls)} unique Zarr URLs")

    # Read existing URLs from CSV if file exists
    existing_urls = set()
    if output_csv.exists():
        with output_csv.open("r", newline="") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                existing_urls.add(row.get("url", ""))

    with Path(output_csv).open("a", newline="") as csvfile:
        # Write header only if file is empty
        if output_csv.stat().st_size == 0:
            writer = csv.writer(csvfile, delimiter=",", quoting=csv.QUOTE_MINIMAL)
            writer.writerow(column_names)
        else:
            writer = csv.writer(csvfile, delimiter=",", quoting=csv.QUOTE_MINIMAL)

        for url in unique_urls:
            if url in existing_urls:
                log.info(f"Skipping {url} (already in CSV)")
                continue

            log.info(f"Processing {url}")
            stats = load_zarr(url, flat=args.flat)

            row = [
                url,
                "flat" if args.flat else "deep",
                stats.get("written", 0),
                format_bytes_human_readable(stats.get("written", 0)),
                list_to_str(stats.get("shape", "")),
                list_to_str(stats.get("shards", "")),
                list_to_str(stats.get("chunks", "")),
                list_to_str(stats.get("dimension_names", "")),
                stats.get("license", ""),
                stats.get("name", ""),
                stats.get("description", ""),
                stats.get("organismId", ""),
                stats.get("fbbiId", ""),
            ]

            writer.writerow(row)

    log.info(f"✅ Done. Results written to {output_csv}")


# ────────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    main()
