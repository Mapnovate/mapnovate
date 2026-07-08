# Kisumu Cadastral & Land Administration Portal

A decision-support web app **developed by Mapnovate** for Kisumu City land officers and private
developers, built from `kisumu_plupa.gpkg` (PLUPA layers) and `kenya_sublocations.geojson`.

## Project structure
```
index.html        — page shell (Bootstrap 4.6 via CDN)
css/style.css     — Mapnovate theme layer over Bootstrap 4
js/app.js         — application logic
data/*.js         — 12 optimized vector datasets (parcels, roads, zoning, contours, …)
assets/           — Mapnovate brand assets (color/white marks & lockups, favicon)
```

## Run it
Keep the folder structure intact and open **index.html** in any modern browser — the
data files load as plain scripts, so it works straight from disk (no server, no CORS
issues). Optionally serve it (`python3 -m http.server`) for the same result.
Internet is only used for basemap tiles and web fonts (the app degrades gracefully offline
— pick the "Survey Dark" basemap).

## Look & feel
- **Light / dark mode** — toggle (☀/☾) on the login card and in the top bar; follows your
  OS preference on first load, and auto-pairs the Carto Light/Dark basemap until you pick
  a basemap yourself.
- Brand palette: `#081D3A` navy · `#00A896` teal · `#2ECC80` green · `#E6ECEF` mist ·
  `#5B6770` slate. Typography: **Poppins** (SemiBold headings, Regular body).

## Sign-in (demo)
| Role | Username | Password | Access |
|---|---|---|---|
| Land Officer | `admin` |  | Full — proprietor names, inspection flags |
| Developer | `guest` | `guest` | Read-only — proprietor names masked |

## What's inside
- **Interactive Leaflet map** (canvas-rendered for speed) with 6 toggleable basemaps.
- **Parcel audit sidebar** — click any parcel: LR No., sheet, registered vs surveyed area
  (with deviation check), tenure, proprietor (role-gated), declared land use.
- **Automated zoning compliance audit** — every parcel was spatially joined (majority
  overlap) against the LPDP land-use classification and its declared use tested against a
  compatibility matrix → Compliant / Conditional / Non-Compliant / Undeclared, shown as a
  rubber-stamp verdict plus zone development standards (ground coverage, plot ratio,
  max floors, min plot).
- **Encroachment screen** — precomputed overlap of each parcel with statutory road
  reserves (15 m / 9 m / 6 m half-widths by class) and the 30 m riparian buffer, plus
  conservation-zone overlap. Gauges show exact percentages; flags fire on thresholds.
- **Registry dashboard** — compliance donut, area totals, and one-click drill-down cards
  (encroachments, zoning conflicts, register/survey mismatches, undeclared parcels).
- **Search** — LR number autocomplete; officers can also search by proprietor.
- **Audit filters** — by compliance status, risk indicator, tenure; filtered set can be
  **exported to CSV**.
- **Symbology switcher** — color parcels by Compliance, Zoning class, Tenure, or Risk.
- **Extras** — distance measure tool, contour/road/label declutter by zoom, sub-location
  population-density choropleth, printable audit extract, coordinate readout & scale bar.

## Audit methodology (precomputed in Python/GeoPandas, EPSG:32736)
- Zoning class per parcel = zoning polygon with the largest area of overlap.
- Compatibility matrix, e.g. RESIDENTIAL→{11,12,13} allowed, {5,9} conditional;
  COMMERCIAL/B.C.R.→{5} allowed; SCHOOL→{2}; INDUSTRIAL→{14,15}; CHURCH→{4}; etc.
- Road-reserve encroachment flag: parcel overlap with reserve buffer > 35 % of parcel.
- Riparian flag: > 5 % overlap or > 200 m² within 30 m of a river.
- Conservation flag: > 10 % of parcel inside Conservation/Water-body zoning.
- Area deviation: surveyed polygon area vs registered plot size (flag at ±15 %).

---
Developed by **Mapnovate** · Geospatial Solutions
