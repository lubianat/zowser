# Zowser

A lighweight browser for curated Zarr collections based on the OME-NGFF 2024 challenge:

[https://ome.github.io/ome2024-ngff-challenge/](https://ome.github.io/ome2024-ngff-challenge/).

## General idea

* general idea:

    zarr config file (a yaml with some hierarchy and Zarr URLs)

    meta config file (title, description, basic information for the instance)

    a viz like the ome2024-ngff-challenge explorer just for the curated zarrs

    a "hydration" step in build where the relevant metadata is pulled from s3 (zarr.json, ro-crate-metadata.json) + browsing infra is set


It may integrate directly with BioFile Finder, as put by Will Moore, it really has the app functionality covered:

E.g. https://bff.allencell.org/app?c=Dataset+Name%3A0.25%2CImage+Name%3A0.25%2CCharacteristics+%5BOrganism%5D%3A0.25%2CTerm+Source+1+REF%3A0.25&source=%7B%22name%22%3A%22idr0170-biofile-finder.csv+%2806%2F08%2F2025+10%3A33%3A43%29%22%2C%22type%22%3A%22csv%22%2C%22uri%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2FIDR%2Fidr0170-rose-mibitof%2Frefs%2Fheads%2Fmain%2FexperimentA%2Fidr0170-biofile-finder.csv%22%7D

## Code 

This is a Svelte.js app for loading CSV file(s) that list NGFF samples and
displaying a summary.

Development: cd into this directory, then...

```
$ npm install
$ npm run dev
```



## Challenge overview

Data generated within the challenge had:

- all v2 arrays converted to v3, optionally sharding the data
- all .zattrs metadata migrated to `zarr.json["attributes"]["ome"]`
- a top-level `ro-crate-metadata.json` file with minimal metadata (specimen and
  imaging modality)

You can example the contents of a sample dataset by using
[the minio client](https://github.com/minio/mc):

```
$ mc alias set add uk1anon https://uk1s3.embassy.ebi.ac.uk "" ""
Added `uk1anon` successfully.
$ mc ls -r uk1anon/idr/share/ome2024-ngff-challenge/0.0.5/6001240.zarr/
[2024-08-01 14:24:35 CEST]  24MiB STANDARD 0/c/0/0/0/0
[2024-08-01 14:24:28 CEST]   598B STANDARD 0/zarr.json
[2024-08-01 14:24:32 CEST] 6.0MiB STANDARD 1/c/0/0/0/0
[2024-08-01 14:24:28 CEST]   598B STANDARD 1/zarr.json
[2024-08-01 14:24:29 CEST] 1.6MiB STANDARD 2/c/0/0/0/0
[2024-08-01 14:24:28 CEST]   592B STANDARD 2/zarr.json
[2024-08-01 14:24:28 CEST] 1.2KiB STANDARD ro-crate-metadata.json
[2024-08-01 14:24:28 CEST] 2.7KiB STANDARD zarr.json
```

Other samples:

- [4496763.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/4496763.zarr)
  Shape `4,25,2048,2048`, Size `589.81 MB`, from idr0047.
- [9822152.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0083/9822152.zarr)
  Shape `1,1,1,93184,144384`, Size `21.57 GB`, from idr0083.
- [9846151.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0048/9846151.zarr)
  Shape `1,3,1402,5192,2947`, Size `66.04 GB`, from idr0048.
- [Week9_090907.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0035/Week9_090907.zarr)
  plate from idr0035.
- [l4_sample/color](https://ome.github.io/ome-ngff-validator/?source=https://data-humerus.webknossos.org/data/zarr3_experimental/scalable_minds/l4_sample/color)
  from WebKnossos.
- Plates from idr0090:
  [190129.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0090/190129.zarr)
  Size `1.0 TB`,
  [190206.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0090/190206.zarr)
  Size `485 GB`,
  [190211.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0090/190211.zarr)
  Size `704 GB`.
- [76-45.zarr](https://ome.github.io/ome-ngff-validator/?source=https://uk1s3.embassy.ebi.ac.uk/idr/share/ome2024-ngff-challenge/idr0010/76-45.zarr)
  plate from idr0010

 <details><summary>Expand for more details on crea

