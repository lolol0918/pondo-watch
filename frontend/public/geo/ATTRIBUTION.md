# Map data attribution

`ph-regions-2023.geojson` is a vendored copy of the low-resolution 2023 region
boundary file from:

- Source: https://github.com/faeldon/philippines-json-maps
- File: `2023/geojson/country/lowres/country.0.001.json`
- License: MIT (Copyright (c) James Faeldon)
- Upstream data: derived from PSA PSGC shapefiles via
  https://github.com/altcoder/philippines-psgc-shapefiles (MIT)

The file reflects PSA PSGC as of 2023-12-31 and contains 17 region features.
It therefore does **not** include the current Negros Island Region (NIR). The
dashboard states this limitation in the UI rather than presenting the map as
covering every region in the project data. `Central Office` is not a
geographic region and is never drawn.

Region codes used by the app are the `adm1_psgc` property in this file. They
are mapped from dataset region labels in `pipeline/regions.py`.
