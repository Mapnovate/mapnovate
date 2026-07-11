'use strict';
/* Cassini Tools — Leaflet spatial preview
   Layers: converted points, ground-control network, Survey-of-Kenya toposheet grid.
   Basemaps: Esri World Imagery (satellite) + OpenStreetMap. */
(function () {
  const CE = window.CassiniEngine;
  const NET = window.CASSINI_CONTROL_NET;
  const $ = id => document.getElementById(id);
  const mapEl = $('map');
  if (!mapEl || !window.L || !CE || !NET) return;

  // ---- basemaps ----
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  });
  const esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
  });
  const esriLabels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, opacity: 0.9
  });
  const satellite = L.layerGroup([esri, esriLabels]);

  const map = L.map(mapEl, {
    center: [0.02, 37.9], zoom: 6, layers: [satellite], zoomControl: true, worldCopyJump: true
  });
  L.control.layers(
    { 'Satellite (Esri)': satellite, 'Street (OSM)': osm },
    {}, { position: 'topright', collapsed: false }
  ).addTo(map);

  // ---- layer groups ----
  const gGrid = L.layerGroup();
  const gCtrl = L.layerGroup();
  const gPts  = L.layerGroup();

  // ================= TOPOSHEET GRID (Survey of Kenya 1:50,000 sheet index) =================
  // Authentic sheet polygons loaded from GeoJSON. Each sheet shows its number and
  // name on click. Styled as a subtle graticule that reads clearly over any basemap.
  const sheetBase = {
    color: '#0d2b52', weight: 0.8, opacity: 0.85,
    fillColor: '#00a896', fillOpacity: 0.04
  };
  const sheetHover = {
    color: '#00a896', weight: 2, opacity: 1,
    fillColor: '#00a896', fillOpacity: 0.18
  };
  let gridLoaded = false;
  function loadToposheets() {
    fetch('data/ke_50_topo_index.geojson')
      .then(r => { if (!r.ok) throw new Error('grid ' + r.status); return r.json(); })
      .then(gj => {
        L.geoJSON(gj, {
          style: () => sheetBase,
          onEachFeature: (feat, layer) => {
            const p = feat.properties || {};
            const no = (p.Sheet_no || p.Sheet_no_1 || '').trim();
            const name = (p.Sheet_name || '').trim();
            const zone = (p.Utm_Zone || '').trim();
            // tooltip: quick sheet number on hover
            if (no) layer.bindTooltip(no, { sticky: true, className: 'pt-tip', direction: 'top' });
            // popup: full sheet number + name on click
            const rows = [];
            rows.push(`<b>Sheet ${no || '—'}</b>`);
            rows.push(name ? name : '<span style="opacity:.6">(unnamed sheet)</span>');
            const extra = [];
            if (p.Sheet_no_1 && p.Sheet_no_1 !== no) extra.push('series ' + p.Sheet_no_1);
            if (zone) extra.push('UTM ' + zone);
            if (extra.length) rows.push('<span style="opacity:.7">' + extra.join(' · ') + '</span>');
            layer.bindPopup(rows.join('<br>'));
            layer.on({
              mouseover: e => e.target.setStyle(sheetHover),
              mouseout:  e => e.target.setStyle(sheetBase)
            });
          }
        }).addTo(gGrid);
        gridLoaded = true;
      })
      .catch(err => { console.warn('Toposheet grid failed to load:', err); });
  }
  loadToposheets();

  // ================= CONTROL POINTS =================
  // control_net groups keyed "<cm><N|S>" hold [cassX_ft, cassY_ft, utmE_m, utmN_m].
  let ctrlBounds = [];
  function buildControl() {
    const zones = (NET.meta && NET.meta.zones) || {};
    Object.keys(NET.control).forEach(key => {
      const cm = parseInt(key, 10);
      const south = key.slice(-1) === 'S';
      const zone = zones[key] || CE.beltZone(cm);
      NET.control[key].forEach(p => {
        const E = p[2], N = p[3];
        let ll;
        try { ll = CE.utmToWgs84(E, N, zone, south); } catch (e) { return; }
        const lat = ll[1], lon = ll[0];
        if (!isFinite(lat) || !isFinite(lon)) return;
        ctrlBounds.push([lat, lon]);
        L.circleMarker([lat, lon], {
          radius: 3, color: '#00a896', weight: 1, fillColor: '#00a896',
          fillOpacity: 0.55, opacity: 0.7
        }).bindPopup(
          `<b>Control point</b><br>belt ${cm}°${south ? 'S' : 'N'} · zone ${zone}<br>` +
          `E ${E.toFixed(1)}  N ${N.toFixed(1)}`
        ).addTo(gCtrl);
      });
    });
  }
  buildControl();

  // ================= CONVERTED POINTS =================
  // Parse the converter output textarea. Forward (c2u) rows look like:
  //   "<E>  <N>   [<cm>°<S|N> · EPSG:xxxxx]"
  // Inverse (u2c) output is Cassini feet; in that case we read the INPUT textarea
  // (which is UTM E/N) plus the belt tag from output to place points.
  const zonesMeta = (NET.meta && NET.meta.zones) || {};
  function parseBeltTag(s) {
    const m = s.match(/\[(\d+)°([SN])/);
    if (!m) return null;
    return { cm: parseInt(m[1], 10), south: m[2] === 'S' };
  }
  function plotConverted() {
    gPts.clearLayers();
    const outLines = $('output').value.split('\n').map(s => s.trim()).filter(Boolean);
    const inLines = $('input').value.split('\n').map(s => s.trim()).filter(Boolean);
    const dirC2U = document.querySelector('#dirToggle button.on')?.dataset.dir !== 'u2c';
    const pts = [];
    for (let i = 0; i < outLines.length; i++) {
      const tag = parseBeltTag(outLines[i]);
      if (!tag) continue;
      const zone = zonesMeta[`${tag.cm}${tag.south ? 'S' : 'N'}`] || CE.beltZone(tag.cm);
      let E, N;
      if (dirC2U) {
        const t = outLines[i].split(/[\s,;]+/);
        E = parseFloat(t[0]); N = parseFloat(t[1]);
      } else {
        // inverse: UTM came from the input textarea (same row order)
        const src = (inLines[i] || '').split(/[\s,;\t]+/);
        E = parseFloat(src[0]); N = parseFloat(src[1]);
      }
      if (!isFinite(E) || !isFinite(N)) continue;
      let ll;
      try { ll = CE.utmToWgs84(E, N, zone, tag.south); } catch (e) { continue; }
      const lat = ll[1], lon = ll[0];
      if (!isFinite(lat) || !isFinite(lon)) continue;
      pts.push([lat, lon]);
      L.circleMarker([lat, lon], {
        radius: 6, color: '#ffffff', weight: 2, fillColor: '#2ecc80', fillOpacity: 0.95
      }).bindPopup(
        `<b>Point ${i + 1}</b><br>belt ${tag.cm}°${tag.south ? 'S' : 'N'} · zone ${zone}<br>` +
        `E ${E.toFixed(2)}  N ${N.toFixed(2)}<br>` +
        `${lat.toFixed(5)}, ${lon.toFixed(5)}`
      ).addTo(gPts);
    }
    if (pts.length) {
      $('mapFoot').innerHTML = `Plotted <b>${pts.length}</b> converted point(s). Click a marker for coordinates.`;
      if ($('tgPts').checked) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
    } else {
      $('mapFoot').innerHTML = 'No plottable points in the current output — run a conversion above.';
    }
    return pts;
  }

  // ---- toggles ----
  function sync(layer, on) { if (on) { if (!map.hasLayer(layer)) map.addLayer(layer); } else map.removeLayer(layer); }
  $('tgGrid').addEventListener('change', e => sync(gGrid, e.target.checked));
  $('tgCtrl').addEventListener('change', e => sync(gCtrl, e.target.checked));
  $('tgPts').addEventListener('change', e => sync(gPts, e.target.checked));

  // default visible layers
  sync(gGrid, $('tgGrid').checked);
  sync(gCtrl, $('tgCtrl').checked);
  sync(gPts, $('tgPts').checked);

  // ---- fit button ----
  $('fitBtn').addEventListener('click', () => {
    const all = [];
    if ($('tgPts').checked) gPts.eachLayer(l => all.push(l.getLatLng()));
    if (!all.length && $('tgCtrl').checked && ctrlBounds.length) ctrlBounds.forEach(b => all.push(b));
    if (all.length) map.fitBounds(all, { padding: [40, 40], maxZoom: 12 });
    else map.setView([0.02, 37.9], 6);
  });

  // ---- hook the converter's Convert button ----
  const runBtn = $('runBtn');
  if (runBtn) runBtn.addEventListener('click', () => setTimeout(plotConverted, 0));

  // fix Leaflet sizing when section scrolled into view / on load
  setTimeout(() => map.invalidateSize(), 200);
  window.addEventListener('resize', () => map.invalidateSize());
})();
