# Salzburg HeatWatch

An interactive Earth observation dashboard exploring surface temperature and vegetation across **Salzburg and Wals-Siezenheim, Austria**.

The dashboard includes **January–December 2025 monthly composites**, 9,709 municipality-clipped parts of a 100 m grid, an annual trend, linked map and charts, cell inspection, observation-day counts, municipality and coverage filters, and CSV downloads. The original 25 June Landsat snapshot is retained separately.

## Run locally

Serve the repository using a static web server, for example:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. The site has no build step, database, or Earth Engine credentials requirement. Leaflet 1.9.4 is bundled in `vendor`; street tiles use OpenStreetMap and optional fonts use Google Fonts. Analysis data and charts are served from this repository.

## Publish with GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, **main**, and **/(root)**, then save. The root `index.html` and `.nojekyll` are ready for static hosting.

Expected URL after a successful deployment: https://talhanaseer-gis.github.io/salzburg-heatwatch/

## What the indicators mean

- **Temperature:** Landsat 8/9 Collection 2 Level-2 surface temperature in Celsius. This measures ground and surface temperature, not air temperature.
- **NDVI:** Sentinel-2 harmonized surface-reflectance NDVI, `(B8 − B4) / (B8 + B4)`. It is not a direct measure of tree shade or public park access.
- **Monthly composites:** overlapping same-day observations are reduced to daily medians, then valid daily medians are combined by month. Pixels require at least two valid acquisition days. Clouds and snow are excluded.
- **Cell averages:** weighted by exported pixel-footprint overlap area in EPSG:25833, excluding missing values. Grid geometry is delivered as WGS 84 GeoJSON.
- **Coverage:** the fraction of the municipality area with qualifying observations. Observation-day means shown for a cell are area-weighted over its qualifying pixels.

Cloudy and snowy months can be very incomplete. Representative-area summary means and annual trend points are withheld below **50% municipality coverage**; this is an illustrative screening threshold, not a validated scientific rule. The separate default **80% cell-coverage filter** only affects selected cells. Local values remain available. No temporal interpolation or invented values are used.

The 30 m Landsat export grid does not imply 30 m thermal resolving power. Seasonal comparisons describe available clear, snow-free daytime observations, not all-weather monthly averages. Park access, population exposure and a priority index have not been calculated.

## Repository contents

```text
index.html, app.js, style.css  Dashboard interface
data/                        Processed grid, monthly attributes and metadata
vendor/                      Leaflet assets and its license
gee/                         Earth Engine monthly export script
scripts/                     Local monthly aggregation workflow
source-data/monthly/         Original 24-band monthly GeoTIFFs and metadata
source-data/original/        Original single-scene and NDVI exports, boundaries
```

Each monthly GeoTIFF contains 24 bands: value and valid-day count, interleaved January through December. The original exports are retained for reproducibility; the browser uses the smaller processed JSON files.

For local aggregation, install `scripts/requirements.txt`, then run `python scripts/build_monthly.py`. It reads the source monthly exports and existing grid geometry, caches spatial weights in `.cache`, and rebuilds processed monthly tables in `data`.

Detailed methods and coverage results: [monthly processing notes](data/MONTHLY_README.md), [validation summaries](data/monthly_validation.json), and [monthly source metadata](data/monthly_source_metadata.csv).

## Sources and attribution

- [USGS Landsat 8/9 Collection 2 Level-2 via Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC09_C02_T1_L2).
- [Copernicus Sentinel-2 harmonized Level-2A via Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED).
- [Statistik Austria municipality boundaries](https://data.statistik.gv.at/web/meta.jsp?dataset=OGDEXT_GEM_1), CC BY 4.0; polygons selected, combined for analysis and intersected with the grid. The uploaded dataset is labelled 2025; its original reference date should be confirmed against the download metadata.
- Basemap: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Leaflet license is retained in [vendor/LEAFLET_LICENSE.txt](vendor/LEAFLET_LICENSE.txt).

This is an exploratory portfolio project. It is not a validated human-health heat-risk assessment. Future observations require updating the exported and processed data; the website does not query Earth Engine live.
