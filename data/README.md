# Salzburg HeatWatch — initial analysis data

## Sources and dates
- Landsat product: LC09_L2SP_192027_20250625_20250627_02_T1
- Surface temperature acquisition: 2025-06-25
- NDVI window: 2025-06-18 to 2025-07-03 (end exclusive).
- Sentinel-2 candidate dates: 2025-06-21; 2025-06-23; 2025-06-26; 2025-07-01.
- Boundary asset: projects/salzburg-heatwatch/assets/austria_municipalities_2025. Uploaded name indicates 2025; confirm the original download's reference date and retain its source/license notice.

## Files
- analysis_grid_100m.geojson: dashboard polygons, geographic WGS 84 coordinates.
- analysis_grid_100m.csv: same attributes without geometry.
- municipal_boundaries.geojson: the two polygon boundaries; a non-area line component in Salzburg's original GeometryCollection was excluded.
- validation_summary.json: municipality results and valid-area coverage.
- source_metadata.csv: original Earth Engine source metadata.

## Method
The grid is aligned to multiples of 100 metres in EPSG:25833. Cells are clipped to each municipality; a square crossing their shared boundary has separate municipality parts. Small boundary pieces are retained except pieces smaller than 0.01 square metres. Geometry is transformed to EPSG:4326 for GeoJSON delivery.

Means use exact pixel-footprint overlap areas in EPSG:25833 at each raster's native export grid: 30 m LST and 10 m NDVI. Masked/non-finite pixels are excluded, never replaced by zero. Valid fractions are valid pixel area divided by clipped cell area. Pixel counts count intersecting valid exported pixels, not independent observations. Per-cell means are null where no valid area exists; blank CSV means are missing data.

Coverage flags use an illustrative 80% cutoff, not a validated scientific threshold. Values remain available below that cutoff. NDVI is a median composite with different dates potentially contributing to each pixel. Its 20 m SCL mask does not guarantee cloud-free results. Temperature is surface temperature, not air temperature; exported 30 m spacing does not imply 30 m thermal resolving power. The 100 m grid adds no spatial information.

Independent full-municipality pixel-overlap reductions agreed with area-weighted cell summaries to within 0.00001 in raster units. This validates aggregation consistency, not satellite retrieval accuracy. Inspect unusually hot pixels in true-colour imagery before interpreting them.

Park distance and priority scores have not been calculated. They must not be presented as available indicators.

## Municipality summaries

- Salzburg: 6858 cell parts; 65.67 km²; LST 35.97 °C over 99.94% of area; NDVI 0.607 over 99.83% of area.
- Wals-Siezenheim: 2851 cell parts; 26.63 km²; LST 34.69 °C over 99.94% of area; NDVI 0.640 over 99.80% of area.
