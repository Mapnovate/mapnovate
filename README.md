# Mapnovate

Corporate website and geospatial web applications for **Mapnovate** — a GIS,
geomatics, and data-science consultancy. *Let's map our world!*

The site is fully static (HTML, CSS, vanilla JS) — no build step, no backend.
It runs straight from disk or from any static host.

## Structure

```
.
├── index.html                  Main Mapnovate marketing site
├── blog.html                   Blog page
├── css/styles.css              Site styles (brand tokens: navy, teal, green, Poppins)
├── js/                         Site scripts (main.js, blog.js)
├── assets/                     Logos and imagery
│
└── apps/                       Live, launchable geospatial applications
    ├── cassini-tools/          Kenya datum-shift & coordinate converter
    │   └── index.html          Self-contained (proj4js via CDN)
    │
    └── kisumu-cadastral/       Kisumu cadastral & land-administration portal
        ├── index.html          Bootstrap 4 + Leaflet
        ├── css/ js/ data/      App styles, logic, and vector datasets
        └── assets/             Mapnovate brand marks
```

The two apps are linked from the **Solutions → Live Apps** section of the
homepage and each carries a "Back to Mapnovate" link in its header.

## The apps

**Cassini Tools** — Converts Kenya's legacy Cassini-Soldner coordinates to
modern datums in the browser. Derives datum-shift parameters via Helmert least
squares (adaptive 3/7-parameter) on the Clarke 1858 ellipsoid, and transforms
points locally with `proj4js`. No data leaves the device.

**Kisumu Cadastral Portal** — A role-based land-registry decision-support tool.
Interactive Leaflet map with parcel audit, automated zoning-compliance checks,
measurement, and register export. Demo sign-in: Officer `admin / kisumu2026`,
Developer `guest / guest`. (Replace the demo auth before any public use.)

## Brand

Palette: `#081D3A` navy · `#00A896` teal · `#2ECC80` green · `#E6ECEF` mist ·
`#5B6770` slate. Typography: **Poppins** (SemiBold headings, Regular body).
Iconography: geometric outline icons, 2px stroke, 4px corner radius.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The apps also work opened directly from disk. An internet connection is only
used for map tiles, web fonts, and the `proj4js` / Bootstrap / Leaflet CDNs.

## Deployment — GitHub Pages (automatic)

Every push to `main` triggers the workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which publishes
the repository root to GitHub Pages. No manual build or `gh-pages` branch is
needed.

**One-time setup:** in the repository, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**. After the first successful
run (see the **Actions** tab), the site is live at:

- Site: `https://mapnovate.github.io/mapnovate/`
- Cassini Tools: `https://mapnovate.github.io/mapnovate/apps/cassini-tools/`
- Kisumu Portal: `https://mapnovate.github.io/mapnovate/apps/kisumu-cadastral/`

A `.nojekyll` file is included so Pages serves all files and folders as-is
(skipping Jekyll processing). To deploy without pushing, run the workflow
manually from the **Actions** tab ("Run workflow").

### Custom domain (optional)

To serve from e.g. `www.mapnovate.com`, add a `CNAME` file at the repo root
containing the domain, configure DNS per GitHub's instructions, and set the
custom domain under **Settings → Pages**.
