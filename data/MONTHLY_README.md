# Salzburg HeatWatch — monthly data, 2025

12 monthly tables join to the existing analysis grid by cell_id. Each table contains 9,709 municipality-clipped grid parts. Geometry is unchanged from the initial dashboard dataset. Values are monthly per-pixel medians of daily medians, followed by area-weighted cell means. At least two valid observation days are required at a pixel. Clouds and snow are excluded, so these describe available clear, snow-free daytime observations, not all-weather monthly averages or air temperature.

Each source GeoTIFF has 24 bands: value and valid acquisition-day count, interleaved January through December. Band descriptions, CRS, units, NDVI range and valid-day thresholds were checked. No temporal interpolation, zero-filling of missing values, or invented data was used.

Spatial means use exact overlap areas between exported pixel footprints and the existing clipped cell polygons in EPSG:25833. Means are null where there is no qualifying observation area. Valid fractions divide eligible observed area by cell area. Observation-day means refer only to eligible pixels, not all pixels in a cell. They are not the number of independent observations of an entire cell.

Monthly summary JSON includes full-municipality coverage before dashboard cell filtering. Low-coverage months must not be interpreted as representative of the whole municipality. In particular, February has very little usable data for both indicators, and November has very little usable LST. The dashboard uses an explicit 50% coverage flag to suppress representative-area means and trend points when coverage is lower. This is an illustrative screening rule, not a validated scientific threshold.

Files: monthly_manifest.json (month/source/quality index); monthly_2025-MM.json (cell attributes); monthly_grid_2025.csv (all 12 months); monthly_validation.json (municipality summaries); monthly_source_metadata.csv (original GEE provenance).
